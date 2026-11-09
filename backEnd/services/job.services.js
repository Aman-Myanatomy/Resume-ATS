import mongoose from 'mongoose';
import Job, { WORK_MODES, EMPLOYMENT_TYPES, JOB_STATUSES, JOB_VISIBILITIES, DEPARTMENTS } from '../models/job.models.js';
import Company from '../models/company.models.js';
import Application from '../models/application.models.js';
import { stageKind, stagesForCompany } from './pipeline.services.js';
import { assertObjectId, escapeRegex, httpError } from '../utils/http.utils.js';
import { assertCanOpenJob } from './billing.services.js';
import { companyLogoUrl } from './company.services.js';
import { isEmployeeOf } from './workplace.services.js';
import User from '../models/user.models.js';

// Public listings never include internal jobs. Older jobs have no visibility field: they are external.
const EXTERNAL = { visibility: { $ne: 'internal' } };

// ---------- Job IDs ----------

/** 2-4 letter prefix from the company name: "Nimbus Labs" -> NIM, "KiranaPay" -> KIR. Unique per company. */
async function ensureJobPrefix(company) {
  if (company.jobPrefix) return company.jobPrefix;
  const letters = String(company.name).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'JOB';
  const candidates = [letters.slice(0, 3), letters.slice(0, 4)];
  for (let i = 2; i <= 9; i += 1) candidates.push(`${letters.slice(0, 2)}${i}`);
  for (const prefix of candidates) {
    if (prefix.length < 2) continue;
    const taken = await Company.exists({ _id: { $ne: company._id }, jobPrefix: prefix });
    if (!taken) {
      const updated = await Company.findOneAndUpdate(
        { _id: company._id, jobPrefix: { $in: [null, ''] } }, { jobPrefix: prefix }, { new: true }
      );
      company.jobPrefix = updated?.jobPrefix || (await Company.findById(company._id).select('jobPrefix')).jobPrefix;
      return company.jobPrefix;
    }
  }
  company.jobPrefix = `J${String(company._id).slice(-3).toUpperCase()}`;
  await Company.updateOne({ _id: company._id }, { jobPrefix: company.jobPrefix });
  return company.jobPrefix;
}

/** Next job ID for the company, e.g. NIM-1004. The counter is incremented atomically. */
export async function nextJobCode(company) {
  const prefix = await ensureJobPrefix(company);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // Companies created before job IDs existed have no counter yet: they start at 1000 too (first ID ...-1001).
    const { jobSeq } = await Company.findByIdAndUpdate(
      company._id,
      [{ $set: { jobSeq: { $add: [{ $max: [{ $ifNull: ['$jobSeq', 1000] }, 1000] }, 1] } } }],
      { new: true }
    ).select('jobSeq');
    const code = `${prefix}-${jobSeq}`;
    if (!(await Job.exists({ jobCode: code }))) return code;
  }
  throw httpError(500, 'Could not create a job ID. Please try again.');
}

/** One-time backfill at startup: gives older jobs a job ID, oldest first. */
export async function ensureJobCodes() {
  const jobs = await Job.find({ $or: [{ jobCode: { $exists: false } }, { jobCode: null }, { jobCode: '' }] })
    .sort({ createdAt: 1 }).select('company');
  const companies = new Map();
  for (const job of jobs) {
    const key = String(job.company);
    if (!companies.has(key)) companies.set(key, await Company.findById(job.company));
    const company = companies.get(key);
    if (!company) continue;
    await Job.updateOne({ _id: job._id }, { jobCode: await nextJobCode(company) });
  }
  if (jobs.length) console.log(`Assigned job IDs to ${jobs.length} existing job(s).`);
}

// Fields that change what the AI scores against. Editing any of them invalidates cached scores.
const SCORING_FIELDS = ['title', 'description', 'skills', 'experienceMin', 'experienceMax', 'location', 'workMode', 'employmentType'];

const LABELS = {
  onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid',
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship'
};

function optionalNumber(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(400, `${label} must be a positive number.`);
  return number;
}

/** Checks min/max pairs on the final values (null/undefined means "no limit"). */
function assertRanges({ experienceMin, experienceMax, salaryMin, salaryMax }) {
  if (experienceMax != null && Number(experienceMax) < Number(experienceMin || 0)) {
    throw httpError(400, 'Maximum experience must be greater than minimum experience.');
  }
  if (salaryMin != null && salaryMax != null && Number(salaryMax) < Number(salaryMin)) {
    throw httpError(400, 'Maximum salary must be greater than minimum salary.');
  }
}

/** Validates and normalises job input from the employer form. `partial` allows PATCH updates. */
export function normalizeJobInput(input = {}, { partial = false } = {}) {
  const out = {};
  const has = key => input[key] !== undefined;

  if (!partial || has('title')) {
    const title = String(input.title || '').trim();
    if (title.length < 3) throw httpError(400, 'Job title must be at least 3 characters.');
    out.title = title.slice(0, 120);
  }
  if (!partial || has('description')) {
    const description = String(input.description || '').trim();
    if (description.length < 80) throw httpError(400, 'Job description must be at least 80 characters so candidates can be scored fairly.');
    out.description = description.slice(0, 12000);
  }
  if (!partial || has('workMode')) {
    const workMode = input.workMode || 'onsite';
    if (!WORK_MODES.includes(workMode)) throw httpError(400, 'Choose on-site, remote or hybrid.');
    out.workMode = workMode;
  }
  if (!partial || has('location')) {
    out.location = String(input.location || '').trim().slice(0, 120);
  }
  if ((out.workMode ?? input.workMode) !== 'remote' && out.location === '' && !partial) {
    throw httpError(400, 'Add a location, or set the job to remote.');
  }
  if (!partial || has('employmentType')) {
    const employmentType = input.employmentType || 'full_time';
    if (!EMPLOYMENT_TYPES.includes(employmentType)) throw httpError(400, 'Choose a valid employment type.');
    out.employmentType = employmentType;
  }
  if (!partial || has('experienceMin')) out.experienceMin = optionalNumber(input.experienceMin, 'Minimum experience') ?? 0;
  if (!partial || has('experienceMax')) out.experienceMax = optionalNumber(input.experienceMax, 'Maximum experience');
  if (!partial || has('salaryMin')) out.salaryMin = optionalNumber(input.salaryMin, 'Minimum salary');
  if (!partial || has('salaryMax')) out.salaryMax = optionalNumber(input.salaryMax, 'Maximum salary');

  if (!partial) assertRanges(out);

  if (!partial || has('skills')) {
    const raw = Array.isArray(input.skills) ? input.skills : String(input.skills || '').split(',');
    const seen = new Set();
    out.skills = raw
      .map(skill => String(skill).trim().slice(0, 40))
      .filter(skill => skill && !seen.has(skill.toLowerCase()) && seen.add(skill.toLowerCase()))
      .slice(0, 20);
  }
  if (!partial || has('screeningQuestions')) {
    const questions = Array.isArray(input.screeningQuestions) ? input.screeningQuestions : [];
    out.screeningQuestions = questions
      .map(q => ({
        question: String(q?.question || '').trim().slice(0, 240),
        requiredAnswer: ['yes', 'no', 'any'].includes(q?.requiredAnswer) ? q.requiredAnswer : 'any'
      }))
      .filter(q => q.question)
      .slice(0, 5);
  }
  if (has('status')) {
    if (!JOB_STATUSES.includes(input.status)) throw httpError(400, 'Choose a valid job status.');
    out.status = input.status;
  }

  // Organisation and posting type.
  if (!partial || has('department')) {
    const department = String(input.department || '').trim().slice(0, 60);
    if (!department) throw httpError(400, 'Choose the department this role belongs to.');
    out.department = department;
  }
  if (!partial || has('team')) out.team = String(input.team || '').trim().slice(0, 80);
  if (!partial || has('project')) out.project = String(input.project || '').trim().slice(0, 80);
  if (!partial || has('hiringManager')) out.hiringManager = String(input.hiringManager || '').trim().slice(0, 80);
  if (!partial || has('openings')) {
    const openings = input.openings === undefined || input.openings === '' || input.openings === null ? 1 : Number(input.openings);
    if (!Number.isInteger(openings) || openings < 1 || openings > 500) throw httpError(400, 'Number of openings must be between 1 and 500.');
    out.openings = openings;
  }
  if (!partial || has('visibility')) {
    const visibility = input.visibility || 'external';
    if (!JOB_VISIBILITIES.includes(visibility)) throw httpError(400, 'Choose external or internal posting.');
    out.visibility = visibility;
  }
  if (!partial || has('referralsEnabled')) out.referralsEnabled = input.referralsEnabled !== false;
  if (!partial || has('referralBonus')) out.referralBonus = String(input.referralBonus || '').trim().slice(0, 120);
  // Internal jobs are applied to directly by employees; referrals only apply to external jobs.
  if (out.visibility === 'internal') {
    out.referralsEnabled = false;
    out.referralBonus = '';
  }
  return out;
}

/** The text the AI scorer receives as the "job description". */
export function buildJobDescription(job) {
  const experience = job.experienceMax != null
    ? `${job.experienceMin || 0}-${job.experienceMax} years`
    : `${job.experienceMin || 0}+ years`;
  return [
    `Job title: ${job.title}`,
    `Company: ${job.companyName}`,
    `Location: ${job.location || 'Not specified'} (${LABELS[job.workMode] || job.workMode})`,
    `Employment type: ${LABELS[job.employmentType] || job.employmentType}`,
    `Experience required: ${experience}`,
    job.skills?.length ? `Required skills: ${job.skills.join(', ')}` : '',
    '',
    job.description
  ].filter(line => line !== '').join('\n');
}

export function publicJob(job, { full = false } = {}) {
  const base = {
    id: job._id,
    jobCode: job.jobCode || '',
    title: job.title,
    department: job.department || '',
    team: job.team || '',
    project: job.project || '',
    openings: job.openings || 1,
    visibility: job.visibility || 'external',
    referralsEnabled: job.visibility !== 'internal' && job.referralsEnabled !== false,
    referralBonus: job.visibility === 'internal' ? '' : (job.referralBonus || ''),
    companyName: job.companyName,
    companySlug: job.companySlug,
    companyLogoUrl: job.companyLogoUrl || (job.companyLogoVersion ? `/api/companies/${job.companySlug}/logo?v=${job.companyLogoVersion}` : null),
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency,
    skills: job.skills,
    status: job.status,
    publishedAt: job.publishedAt
  };
  if (!full) return { ...base, excerpt: job.description.slice(0, 220) };
  return {
    ...base,
    description: job.description,
    screeningQuestions: (job.screeningQuestions || []).map(q => ({ question: q.question }))
  };
}

function employerJob(job) {
  return {
    ...publicJob(job, { full: true }),
    screeningQuestions: job.screeningQuestions,
    hiringManager: job.hiringManager || '',
    applicationCount: job.applicationCount,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

// ---------- Public board ----------

export async function searchPublicJobs({ q, location, workMode, employmentType, department, page = 1, limit = 20 } = {}) {
  const filter = { status: 'open', ...EXTERNAL };
  if (q && String(q).trim()) {
    const term = String(q).trim().slice(0, 80);
    const pattern = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ title: pattern }, { skills: pattern }, { companyName: pattern }, { department: pattern }, { jobCode: term.toUpperCase() }];
  }
  if (department && DEPARTMENTS.includes(department)) filter.department = department;
  if (location && String(location).trim()) {
    filter.location = new RegExp(escapeRegex(String(location).trim().slice(0, 80)), 'i');
  }
  if (WORK_MODES.includes(workMode)) filter.workMode = workMode;
  if (EMPLOYMENT_TYPES.includes(employmentType)) filter.employmentType = employmentType;

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ publishedAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize),
    Job.countDocuments(filter)
  ]);
  return { jobs: jobs.map(job => publicJob(job)), total, page: pageNumber, pages: Math.ceil(total / pageSize) };
}

/**
 * A job's public page. Accepts the database id or the job ID (e.g. NIM-1004).
 * Internal jobs are visible only to the company's employees; everyone else gets a 404
 * (or a 403 with a hint when they are signed in, so employees know to use their work email).
 */
export async function getPublicJob(jobId, viewerId) {
  const byCode = /^[A-Za-z0-9]{2,5}-\d{3,7}$/.test(String(jobId || ''));
  if (!byCode) assertObjectId(jobId, 'Job');
  const job = await Job.findOne({ ...(byCode ? { jobCode: String(jobId).toUpperCase() } : { _id: jobId }), status: { $in: ['open', 'closed'] } });
  if (!job) throw httpError(404, 'Job not found.');
  if (job.visibility === 'internal') {
    const viewer = viewerId ? await User.findById(viewerId).select('email role') : null;
    if (!viewer || !(await isEmployeeOf(viewer, job.company))) {
      throw httpError(viewer ? 403 : 404, viewer
        ? `This is an internal job for ${job.companyName} employees. Sign in with your ${job.companyName} work email to view it.`
        : 'Job not found.');
    }
  }
  const company = await Company.findById(job.company).select('name slug website location size about logo.url logo.version');
  return {
    job: publicJob(job, { full: true }),
    companyId: job.company,
    company: company ? {
      name: company.name, slug: company.slug, website: company.website || '',
      location: company.location || '', size: company.size || '', about: company.about || '',
      logoUrl: companyLogoUrl(company)
    } : null
  };
}

export async function getOpenJobsForCompany(companyId) {
  const jobs = await Job.find({ company: companyId, status: 'open', ...EXTERNAL }).sort({ publishedAt: -1 }).limit(50);
  return jobs.map(job => publicJob(job));
}

// ---------- Employer ----------

export async function getEmployerJob(jobId, companyId) {
  assertObjectId(jobId, 'Job');
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) throw httpError(404, 'Job not found.');
  return job;
}

export async function createJob({ companyId, userId, input }) {
  const company = await Company.findById(companyId);
  if (!company) throw httpError(404, 'Company not found.');
  const data = normalizeJobInput(input);
  if (data.visibility === 'internal' && !company.emailDomains?.length) {
    throw httpError(400, 'Add your employee email domain in Company profile before posting an internal job, so employees can see it.');
  }
  const status = input.status === 'draft' ? 'draft' : 'open';
  if (status === 'open') await assertCanOpenJob(company);
  const job = await Job.create({
    ...data,
    jobCode: await nextJobCode(company),
    status,
    company: company._id,
    companyName: company.name,
    companySlug: company.slug,
    companyLogoUrl: companyLogoUrl(company) || undefined,
    companyLogoVersion: company.logo?.version || 0,
    postedBy: userId,
    publishedAt: status === 'open' ? new Date() : undefined
  });
  return employerJob(job);
}

export async function updateJob({ jobId, companyId, input }) {
  const job = await getEmployerJob(jobId, companyId);
  const updates = normalizeJobInput(input, { partial: true });

  const finalMode = updates.workMode ?? job.workMode;
  const finalLocation = updates.location ?? job.location;
  if (finalMode !== 'remote' && !finalLocation) throw httpError(400, 'Add a location, or set the job to remote.');
  // Validate ranges against the merged result, so a partial edit can't create min > max.
  const pick = key => (key in updates ? updates[key] : job[key]);
  assertRanges({
    experienceMin: pick('experienceMin'),
    experienceMax: pick('experienceMax'),
    salaryMin: pick('salaryMin'),
    salaryMax: pick('salaryMax')
  });

  if (updates.visibility === 'internal' && job.visibility !== 'internal') {
    const company = await Company.findById(companyId).select('emailDomains');
    if (!company?.emailDomains?.length) {
      throw httpError(400, 'Add your employee email domain in Company profile before making a job internal.');
    }
  }

  if (updates.status === 'open' && job.status !== 'open') {
    const company = await Company.findById(companyId);
    await assertCanOpenJob(company, { excludeJobId: job._id });
  }

  const scoringChanged = SCORING_FIELDS.some(field =>
    field in updates && JSON.stringify(updates[field] ?? null) !== JSON.stringify(job[field] ?? null)
  );
  Object.assign(job, updates);
  if (scoringChanged) job.contentVersion += 1;
  if (updates.status === 'open' && !job.publishedAt) job.publishedAt = new Date();
  await job.save();
  return employerJob(job);
}

export const TOP_FIT_SCORE = 75;

/**
 * The employer's jobs with pipeline counts and the numbers a recruiter acts on:
 * applicants this week, top-fit candidates (score >= 75) and average fit score.
 */
export async function listEmployerJobs(companyId) {
  const company = new mongoose.Types.ObjectId(String(companyId));
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [stages, jobs, byStage, byJobStats] = await Promise.all([
    stagesForCompany(companyId),
    Job.find({ company: companyId }).sort({ createdAt: -1 }),
    Application.aggregate([
      { $match: { company } },
      { $group: { _id: { job: '$job', stage: '$stage' }, count: { $sum: 1 } } }
    ]),
    Application.aggregate([
      { $match: { company } },
      {
        $group: {
          _id: '$job',
          pending: { $sum: { $cond: [{ $in: ['$scoreStatus', ['pending', 'scoring']] }, 1, 0] } },
          newThisWeek: { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0] } },
          topFit: { $sum: { $cond: [{ $gte: ['$score', TOP_FIT_SCORE] }, 1, 0] } },
          avgScore: { $avg: '$score' }, // ignores unscored (null) applications
          referrals: { $sum: { $cond: [{ $eq: ['$source', 'referral'] }, 1, 0] } },
          internal: { $sum: { $cond: [{ $eq: ['$source', 'internal'] }, 1, 0] } },
          lastAppliedAt: { $max: '$createdAt' }
        }
      }
    ])
  ]);

  const emptyPipeline = () => Object.fromEntries(stages.map(s => [s.key, 0]));
  // Same counts grouped by what the stage means, for charts that work with any custom pipeline.
  const byKind = pipeline => Object.entries(pipeline).reduce((acc, [key, count]) => {
    const kind = stageKind(stages, key);
    acc[kind] = (acc[kind] || 0) + count;
    return acc;
  }, {});
  const pipelines = new Map();
  for (const row of byStage) {
    const key = String(row._id.job);
    if (!pipelines.has(key)) pipelines.set(key, emptyPipeline());
    pipelines.get(key)[row._id.stage] = (pipelines.get(key)[row._id.stage] || 0) + row.count;
  }
  const stats = new Map(byJobStats.map(row => [String(row._id), row]));

  return jobs.map(job => {
    const s = stats.get(String(job._id));
    return {
      ...employerJob(job),
      pipeline: pipelines.get(String(job._id)) || emptyPipeline(),
      pipelineByKind: byKind(pipelines.get(String(job._id)) || emptyPipeline()),
      pendingScores: s?.pending || 0,
      newThisWeek: s?.newThisWeek || 0,
      topFit: s?.topFit || 0,
      avgScore: s?.avgScore == null ? null : Math.round(s.avgScore),
      referrals: s?.referrals || 0,
      internalApplicants: s?.internal || 0,
      lastAppliedAt: s?.lastAppliedAt || null
    };
  });
}

export async function getEmployerJobDetail(jobId, companyId) {
  return employerJob(await getEmployerJob(jobId, companyId));
}
