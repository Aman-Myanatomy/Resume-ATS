import Application from '../models/application.models.js';
import Analysis from '../models/analysis.models.js';
import Job from '../models/job.models.js';
import { generateAtsAnalysis } from './analysis.services.js';
import { buildJobDescription } from './job.services.js';
import { canScoreForCompany } from './billing.services.js';

/**
 * In-process background scoring queue.
 *
 * Applying returns immediately; the AI fit report is produced here afterwards so a slow
 * model call never blocks the candidate. On restart, unfinished applications are re-queued.
 * This is enough for an MVP on a single server. Move to Redis + BullMQ once there are
 * several API instances.
 */
const CONCURRENCY = Math.max(1, Number(process.env.SCORING_CONCURRENCY) || 2);
const queue = [];
const queued = new Set();
let active = 0;

export function enqueueScoring(applicationId) {
  const id = String(applicationId);
  if (queued.has(id)) return;
  queued.add(id);
  queue.push(id);
  drain();
}

function drain() {
  while (active < CONCURRENCY && queue.length) {
    const id = queue.shift();
    active += 1;
    scoreApplication(id)
      .catch(error => console.error(`Scoring application ${id} failed:`, error.message))
      .finally(() => {
        active -= 1;
        queued.delete(id);
        drain();
      });
  }
}

const MAX_ATTEMPTS = 3;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Retries temporary model/network failures with backoff (5s, then 15s). Input errors fail at once. */
async function scoreWithRetry(resumeText, jobDescription) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return (await generateAtsAnalysis(resumeText, jobDescription)).result;
    } catch (error) {
      lastError = error;
      const status = error.statusCode || 0;
      const permanent = status === 400 || (status === 503 && /not configured/i.test(error.message));
      if (permanent || attempt === MAX_ATTEMPTS) break;
      await wait(attempt === 1 ? 5_000 : 15_000);
    }
  }
  throw lastError;
}

async function scoreApplication(id) {
  const application = await Application.findById(id).select('+resumeText');
  if (!application) return;

  const job = await Job.findById(application.job);
  if (!job) {
    await Application.updateOne({ _id: id }, { scoreStatus: 'failed', scoreError: 'The job was deleted.' });
    return;
  }

  // Respect the company's monthly AI scoring quota. The application is kept; an upgrade + rescore scores it.
  if (!(await canScoreForCompany(application.company))) {
    await Application.updateOne({ _id: id }, { scoreStatus: 'over_limit', $unset: { scoreError: 1 } });
    return;
  }

  await Application.updateOne({ _id: id }, { scoreStatus: 'scoring' });

  try {
    // Reuse a fit check the candidate already ran with the same resume against the same job version.
    const cached = await Analysis.findOne({
      user: application.candidate,
      job: job._id,
      resumeHash: application.resumeHash,
      jobVersion: job.contentVersion
    }).sort({ createdAt: -1 });

    const result = cached
      ? cached.result
      : await scoreWithRetry(application.resumeText, buildJobDescription(job));

    await Application.updateOne({ _id: id }, {
      score: Math.round(result.score),
      result,
      scoreStatus: 'scored',
      scoredAt: new Date(),
      jobVersion: job.contentVersion,
      $unset: { scoreError: 1 }
    });
  } catch (error) {
    await Application.updateOne({ _id: id }, {
      scoreStatus: 'failed',
      scoreError: String(error.message || 'Scoring failed.').slice(0, 300)
    });
    throw error;
  }
}

/** Re-queues applications left unscored by a restart or crash. */
export async function resumePendingScoring() {
  const pending = await Application.find({ scoreStatus: { $in: ['pending', 'scoring'] } })
    .sort({ createdAt: 1 })
    .select('_id')
    .limit(1000);
  pending.forEach(application => enqueueScoring(application._id));
  if (pending.length) console.log(`Re-queued ${pending.length} application(s) for AI scoring.`);
}
