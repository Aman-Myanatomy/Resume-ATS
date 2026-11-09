import Application, { APPLICATION_SOURCES } from '../models/application.models.js';
import Analysis from '../models/analysis.models.js';
import Job from '../models/job.models.js';
import User from '../models/user.models.js';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary.config.js';
import { generateAtsAnalysis, parseResumeText } from './analysis.services.js';
import { uploadResume } from './fileStorage.services.js';
import { buildJobDescription, getEmployerJob } from './job.services.js';
import { enqueueScoring } from './scoring.services.js';
import { notifyApplicationReceived, notifyStageChange } from './notification.services.js';
import { interviewView } from './interview.services.js';
import { isEmployeeOf, recordReferralApplication, resolveApplicationSource } from './workplace.services.js';
import {
  DEFAULT_STAGES, findStage, stageKind, stageLabel, stagesForCompanies, stagesForCompany
} from './pipeline.services.js';
import { assertObjectId, hashText, httpError } from '../utils/http.utils.js';

/** The next scheduled interview that hasn't happened yet (allowing a 1h grace for ones in progress). */
function nextInterview(app) {
  const cutoff = Date.now() - 3600000;
  const upcoming = (app.interviews || [])
    .filter(i => i.status === 'scheduled' && new Date(i.scheduledAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
  return upcoming || null;
}

const MIN_RESUME_CHARS = 80;

// ---------- Candidate resume ----------

async function loadCandidate(userId) {
  const user = await User.findById(userId).select('+resume.text');
  if (!user) throw httpError(401, 'Your account no longer exists. Please sign in again.');
  if (user.role !== 'candidate') throw httpError(403, 'Employer accounts cannot apply to jobs. Sign in with a job seeker account.');
  return user;
}

/**
 * Works out which resume to use: a new upload, pasted text, or the candidate's saved resume.
 * Returns isNew=true when the candidate supplied a new resume, which then becomes their saved one.
 */
async function resolveResume(user, { file, text }) {
  if (file || (text && String(text).trim())) {
    const { text: extracted, resumeFileMetadata } = await parseResumeText(file, text ? String(text) : '');
    const clean = String(extracted || '').trim();
    if (clean.length < MIN_RESUME_CHARS) {
      throw httpError(400, 'We could not read enough text from that resume. Upload a text-based PDF or DOCX, or paste the text.');
    }
    return {
      text: clean.slice(0, 30000),
      fileName: file?.originalname || 'Pasted resume',
      fileMeta: resumeFileMetadata,
      isNew: true
    };
  }
  if (user.resume?.text) {
    return { text: user.resume.text, fileName: user.resume.fileName || 'Saved resume', fileMeta: null, isNew: false };
  }
  throw httpError(400, 'Upload your resume or paste its text first.');
}

async function saveResumeToProfile(userId, resume) {
  await User.updateOne({ _id: userId }, {
    resume: {
      text: resume.text,
      fileName: resume.fileName,
      mimeType: resume.fileMeta?.mimeType || 'text/plain',
      updatedAt: new Date()
    }
  });
}

export async function getSavedResume(userId) {
  const user = await User.findById(userId).select('+resume.text');
  if (!user?.resume?.text) return { resume: null };
  return {
    resume: {
      fileName: user.resume.fileName,
      updatedAt: user.resume.updatedAt,
      words: user.resume.text.split(/\s+/).filter(Boolean).length,
      preview: user.resume.text.slice(0, 600)
    }
  };
}

export async function saveResume(userId, { file, text }) {
  const user = await loadCandidate(userId);
  const resume = await resolveResume(user, { file, text });
  if (!resume.isNew) throw httpError(400, 'Upload your resume or paste its text first.');
  await saveResumeToProfile(user._id, resume);
  return getSavedResume(user._id);
}

// ---------- Candidate: fit check & apply ----------

async function loadOpenJob(jobId, user) {
  assertObjectId(jobId, 'Job');
  const job = await Job.findById(jobId);
  if (!job || job.status === 'draft') throw httpError(404, 'Job not found.');
  if (job.visibility === 'internal' && !(await isEmployeeOf(user, job.company))) {
    throw httpError(403, `This is an internal job. Only ${job.companyName} employees can apply.`);
  }
  if (job.status !== 'open') throw httpError(410, 'This job is no longer accepting applications.');
  return job;
}

export async function checkFit({ jobId, userId, file, text }) {
  const user = await loadCandidate(userId);
  const job = await loadOpenJob(jobId, user);
  const resume = await resolveResume(user, { file, text });
  const resumeHash = hashText(resume.text);

  if (resume.isNew) await saveResumeToProfile(user._id, resume);

  const cached = await Analysis.findOne({ user: user._id, job: job._id, resumeHash, jobVersion: job.contentVersion })
    .sort({ createdAt: -1 });
  if (cached) return { analysis: cached.result, cached: true };

  const jobDescription = buildJobDescription(job);
  const { result, source } = await generateAtsAnalysis(resume.text, jobDescription);
  await Analysis.create({
    user: user._id,
    job: job._id,
    jobVersion: job.contentVersion,
    resumeHash,
    resumeName: resume.fileName,
    resumeText: resume.text,
    resumeFile: resume.fileMeta || undefined,
    jobDescription,
    score: result.score,
    result,
    source
  });
  return { analysis: result, cached: false };
}

export async function applyToJob({ jobId, userId, file, text, coverNote, answers = [], refCode }) {
  const user = await loadCandidate(userId);
  const job = await loadOpenJob(jobId, user);

  if (await Application.exists({ job: job._id, candidate: user._id })) {
    throw httpError(409, 'You have already applied to this job.');
  }

  const questions = job.screeningQuestions || [];
  const answerList = Array.isArray(answers) ? answers : [];
  const recordedAnswers = questions.map((q, index) => {
    const answer = answerList[index];
    if (answer !== 'yes' && answer !== 'no') throw httpError(400, `Answer the question: "${q.question}"`);
    return { question: q.question, answer };
  });
  const knockoutFailed = questions.some((q, index) => q.requiredAnswer !== 'any' && recordedAnswers[index].answer !== q.requiredAnswer);

  const resume = await resolveResume(user, { file, text });
  const { source, referral, referralDoc } = await resolveApplicationSource({ job, user, refCode });

  let resumeAsset;
  if (file) {
    try {
      resumeAsset = (await uploadResume(file)) || undefined;
    } catch (error) {
      // The parsed text is what matters for screening; don't fail the application over storage.
      console.error('Resume upload to Cloudinary failed:', error.message);
    }
  }

  let application;
  try {
    application = await Application.create({
      job: job._id,
      company: job.company,
      candidate: user._id,
      candidateName: user.name,
      candidateEmail: user.email,
      resumeText: resume.text,
      resumeHash: hashText(resume.text),
      resumeName: resume.fileName,
      resumeFile: resume.fileMeta ? { mimeType: resume.fileMeta.mimeType, size: resume.fileMeta.size } : undefined,
      resumeAsset,
      coverNote: coverNote ? String(coverNote).trim().slice(0, 2000) : undefined,
      answers: recordedAnswers,
      knockoutFailed,
      source,
      referral,
      stageHistory: [{ stage: 'applied', by: user._id }]
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'You have already applied to this job.');
    throw error;
  }

  await Job.updateOne({ _id: job._id }, { $inc: { applicationCount: 1 } });
  if (resume.isNew) await saveResumeToProfile(user._id, resume);
  enqueueScoring(application._id);
  notifyApplicationReceived({ application, job });
  recordReferralApplication({ referralDoc, application, job });

  return { application: { id: application._id, stage: application.stage, scoreStatus: application.scoreStatus, source } };
}

// Candidates see a softer label for rejection.
function candidateStage(stage) {
  return stage === 'rejected' ? 'not_selected' : stage;
}

/** Stage fields a candidate sees: key, label, kind, and the company's steps for the progress bar. */
function candidateStageView(stages, stage) {
  const key = candidateStage(stage);
  return {
    stage: key,
    stageLabel: stage === 'rejected' ? 'Not moving forward' : stageLabel(stages, stage),
    stageKind: stage === 'rejected' ? 'not_selected' : stageKind(stages, stage),
    progress: stages.filter(s => s.kind !== 'rejected').map(s => ({ key: s.key, label: s.label, kind: s.kind }))
  };
}

// What a candidate may see about their interview (no internal notes or interviewer IDs).
function candidateInterview(app) {
  if (app.stage === 'rejected') return null;
  const next = nextInterview(app);
  if (!next) return null;
  return {
    scheduledAt: next.scheduledAt,
    durationMins: next.durationMins,
    mode: next.mode,
    location: next.location || '',
    interviewerNames: next.interviewerNames || []
  };
}

export async function listMyApplications(userId) {
  const applications = await Application.find({ candidate: userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('job', 'title jobCode companyName companySlug location workMode status visibility');

  const stagesOf = await stagesForCompanies(applications.map(a => a.company));
  return applications.map(app => ({
    nextInterview: candidateInterview(app),
    id: app._id,
    job: app.job ? {
      id: app.job._id,
      title: app.job.title,
      jobCode: app.job.jobCode || '',
      visibility: app.job.visibility || 'external',
      companyName: app.job.companyName,
      companySlug: app.job.companySlug,
      location: app.job.location,
      workMode: app.job.workMode,
      status: app.job.status
    } : null,
    ...candidateStageView(stagesOf(app.company), app.stage),
    source: app.source || 'direct',
    referredBy: app.source === 'referral' ? app.referral?.referrerName || '' : '',
    score: app.score,
    scoreStatus: app.scoreStatus,
    appliedAt: app.createdAt,
    updatedAt: app.updatedAt
  }));
}

export async function getMyJobStatus(userId, jobId, companyId) {
  const [application, fit] = await Promise.all([
    Application.findOne({ candidate: userId, job: jobId }).select('company stage score scoreStatus createdAt interviews'),
    Analysis.findOne({ user: userId, job: jobId }).sort({ createdAt: -1 }).select('score result createdAt')
  ]);
  const user = await User.findById(userId).select('role email resume.fileName resume.updatedAt');
  return {
    role: user?.role || 'candidate',
    // Employees of the hiring company see referral tools on external jobs and can apply to internal ones.
    isEmployee: companyId ? await isEmployeeOf(user, companyId) : false,
    savedResume: user?.resume?.fileName ? { fileName: user.resume.fileName, updatedAt: user.resume.updatedAt } : null,
    application: application ? {
      id: application._id,
      ...candidateStageView(await stagesForCompany(application.company), application.stage),
      score: application.score,
      scoreStatus: application.scoreStatus,
      appliedAt: application.createdAt,
      nextInterview: candidateInterview(application)
    } : null,
    lastFit: fit ? { score: fit.score, analysis: fit.result, checkedAt: fit.createdAt } : null
  };
}

// ---------- Employer: review pipeline ----------

function applicantSummary(app, stages = DEFAULT_STAGES) {
  return {
    stageLabel: stageLabel(stages, app.stage),
    stageKind: stageKind(stages, app.stage),
    id: app._id,
    candidateName: app.candidateName,
    candidateEmail: app.candidateEmail,
    resumeName: app.resumeName,
    score: app.score,
    scoreStatus: app.scoreStatus,
    scoreError: app.scoreStatus === 'failed' ? app.scoreError : undefined,
    stage: app.stage,
    knockoutFailed: app.knockoutFailed,
    source: app.source || 'direct',
    referrerName: app.source === 'referral' ? app.referral?.referrerName || '' : '',
    verdict: app.result?.verdict || null,
    summary: app.result?.summary || null,
    matched: (app.result?.keywords?.matched || []).slice(0, 6),
    missing: (app.result?.keywords?.missing || []).slice(0, 6),
    noteCount: app.notes?.length || 0,
    nextInterviewAt: nextInterview(app)?.scheduledAt || null,
    appliedAt: app.createdAt
  };
}

export async function listJobApplicants({ jobId, companyId, stage, source, sort = 'score' }) {
  const job = await getEmployerJob(jobId, companyId);
  const stages = await stagesForCompany(companyId);
  const filter = { job: job._id, company: companyId };
  if (findStage(stages, stage)) filter.stage = stage;
  if (APPLICATION_SOURCES.includes(source)) filter.source = source === 'direct' ? { $in: ['direct', null] } : source;
  const order = sort === 'recent' ? { createdAt: -1 } : { score: -1, createdAt: -1 };

  const applications = await Application.find(filter).sort(order).limit(500)
    .select('candidateName candidateEmail resumeName score scoreStatus scoreError stage knockoutFailed source referral result notes interviews createdAt');
  return { applicants: applications.map(app => applicantSummary(app, stages)) };
}

async function loadEmployerApplication(applicationId, companyId, withResume = false) {
  assertObjectId(applicationId, 'Application');
  const query = Application.findOne({ _id: applicationId, company: companyId });
  if (withResume) query.select('+resumeText');
  const application = await query;
  if (!application) throw httpError(404, 'Application not found.');
  return application;
}

function signedResumeUrl(asset) {
  if (!asset?.publicId || !cloudinaryConfigured) return null;
  try {
    return cloudinary.utils.private_download_url(asset.publicId, '', {
      resource_type: asset.resourceType || 'raw',
      type: 'private',
      expires_at: Math.floor(Date.now() / 1000) + 10 * 60
    });
  } catch {
    return null;
  }
}

function applicationDetail(app, stages = DEFAULT_STAGES) {
  return {
    ...applicantSummary(app, stages),
    jobId: app.job,
    result: app.result || null,
    resumeText: app.resumeText,
    resumeUrl: signedResumeUrl(app.resumeAsset),
    coverNote: app.coverNote || '',
    referral: app.source === 'referral' && app.referral ? {
      referrerName: app.referral.referrerName || '',
      referrerEmail: app.referral.referrerEmail || '',
      relationship: app.referral.relationship || '',
      note: app.referral.note || ''
    } : null,
    answers: app.answers || [],
    stageHistory: (app.stageHistory || []).map(h => ({ stage: h.stage, label: stageLabel(stages, h.stage), at: h.at })),
    notes: (app.notes || []).map(note => ({
      id: note._id, authorName: note.authorName, text: note.text, createdAt: note.createdAt
    })),
    interviews: (app.interviews || [])
      .map(interviewView)
      .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)),
    scoredAt: app.scoredAt
  };
}

export { applicationDetail };

export async function getApplicationForEmployer(applicationId, companyId) {
  const [application, stages] = await Promise.all([loadEmployerApplication(applicationId, companyId, true), stagesForCompany(companyId)]);
  return { application: applicationDetail(application, stages) };
}

export async function updateApplicationStage({ applicationId, companyId, userId, stage }) {
  const stages = await stagesForCompany(companyId);
  const target = findStage(stages, stage);
  if (!target) throw httpError(400, 'Choose a valid pipeline stage.');
  const application = await loadEmployerApplication(applicationId, companyId, true);
  if (application.stage !== stage) {
    application.stage = stage;
    application.stageHistory.push({ stage, by: userId });
    await application.save();
    const job = await Job.findById(application.job).select('title companyName');
    notifyStageChange({ application, job, stage, kind: target.kind, label: target.label });
  }
  return { application: applicationDetail(application, stages) };
}

export async function addApplicationNote({ applicationId, companyId, userId, authorName, text }) {
  const clean = String(text || '').trim();
  if (!clean) throw httpError(400, 'Write a note first.');
  const application = await loadEmployerApplication(applicationId, companyId, true);
  application.notes.push({ author: userId, authorName, text: clean.slice(0, 2000) });
  await application.save();
  return { application: applicationDetail(application, await stagesForCompany(companyId)) };
}

export async function rescoreApplication({ applicationId, companyId }) {
  const application = await loadEmployerApplication(applicationId, companyId);
  if (application.scoreStatus === 'pending' || application.scoreStatus === 'scoring') {
    return { application: { id: application._id, scoreStatus: application.scoreStatus } };
  }
  await Application.updateOne({ _id: application._id }, { scoreStatus: 'pending', $unset: { scoreError: 1 } });
  enqueueScoring(application._id);
  return { application: { id: application._id, scoreStatus: 'pending' } };
}
