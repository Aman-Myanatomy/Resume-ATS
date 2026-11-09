import Application, { INTERVIEW_MODES } from '../models/application.models.js';
import Job from '../models/job.models.js';
import User from '../models/user.models.js';
import { notifyInterview } from './notification.services.js';
import { assertObjectId, httpError } from '../utils/http.utils.js';
import { companyStages, interviewStageFor } from './pipeline.services.js';

export function interviewView(interview) {
  return {
    id: interview._id,
    scheduledAt: interview.scheduledAt,
    durationMins: interview.durationMins,
    mode: interview.mode,
    location: interview.location || '',
    interviewers: (interview.interviewers || []).map(String),
    interviewerNames: interview.interviewerNames || [],
    note: interview.note || '',
    status: interview.status,
    createdByName: interview.createdByName || ''
  };
}

function normalizeInterview(input = {}) {
  const scheduledAt = new Date(input.scheduledAt);
  if (!input.scheduledAt || Number.isNaN(scheduledAt.getTime())) throw httpError(400, 'Pick a date and time for the interview.');
  if (scheduledAt.getTime() < Date.now() - 5 * 60000) throw httpError(400, 'The interview time is in the past. Pick a future time.');
  if (scheduledAt.getTime() > Date.now() + 365 * 86400000) throw httpError(400, 'Pick a time within the next year.');

  const durationMins = Number(input.durationMins ?? 45);
  if (!Number.isInteger(durationMins) || durationMins < 15 || durationMins > 240) throw httpError(400, 'Duration must be between 15 and 240 minutes.');

  const mode = input.mode || 'video';
  if (!INTERVIEW_MODES.includes(mode)) throw httpError(400, 'Choose video, phone or on-site.');

  const location = String(input.location || '').trim().slice(0, 300);
  if (mode === 'video' && location && !/^https?:\/\//i.test(location)) throw httpError(400, 'Meeting link must start with http:// or https://');

  const interviewerIds = Array.isArray(input.interviewers) ? [...new Set(input.interviewers.map(String))].slice(0, 10) : [];
  // (MVP: one person per company, so the person scheduling is the interviewer; see scheduleInterview.)
  interviewerIds.forEach(id => assertObjectId(id, 'Interviewer'));

  return { scheduledAt, durationMins, mode, location, interviewerIds, note: String(input.note || '').trim().slice(0, 1000) };
}

async function loadApplication(employer, applicationId) {
  assertObjectId(applicationId, 'Application');
  const application = await Application.findOne({ _id: applicationId, company: employer.companyId }).select('+resumeText');
  if (!application) throw httpError(404, 'Application not found.');
  return application;
}

export async function scheduleInterview(employer, applicationId, input) {
  const application = await loadApplication(employer, applicationId);
  if (['rejected', 'hired'].includes(application.stage)) {
    throw httpError(400, `This candidate is marked ${application.stage}. Move them back to an active stage first.`);
  }
  const data = normalizeInterview(input);
  // One person runs hiring in the MVP: they are the interviewer and get the calendar invite.
  if (!data.interviewerIds.length) data.interviewerIds = [String(employer.userId)];

  // Interviewers must be active members of the same company.
  const interviewers = data.interviewerIds.length
    ? await User.find({ _id: { $in: data.interviewerIds }, company: employer.companyId, active: { $ne: false } }).select('name')
    : [];
  if (interviewers.length !== data.interviewerIds.length) throw httpError(400, 'Interviewers must be members of your team.');

  application.interviews.push({
    scheduledAt: data.scheduledAt,
    durationMins: data.durationMins,
    mode: data.mode,
    location: data.location,
    interviewers: interviewers.map(u => u._id),
    interviewerNames: interviewers.map(u => u.name),
    note: data.note,
    createdBy: employer.userId,
    createdByName: employer.name
  });
  // Candidates still before the company's first interview stage move into it.
  const interviewStage = interviewStageFor(companyStages(employer.company), application.stage);
  const stageMoved = Boolean(interviewStage);
  if (stageMoved) {
    application.stage = interviewStage;
    application.stageHistory.push({ stage: interviewStage, by: employer.userId });
  }
  await application.save();

  const interview = application.interviews[application.interviews.length - 1];
  const job = await Job.findById(application.job);
  if (job) notifyInterview({ application, job, interview, change: 'scheduled' });
  return { application, interview: interviewView(interview), stageMoved };
}

export async function updateInterviewStatus(employer, applicationId, interviewId, status) {
  if (!['completed', 'cancelled'].includes(status)) throw httpError(400, 'Mark the interview as completed or cancelled.');
  const application = await loadApplication(employer, applicationId);
  assertObjectId(interviewId, 'Interview');
  const interview = application.interviews.id(interviewId);
  if (!interview) throw httpError(404, 'Interview not found.');
  if (interview.status !== 'scheduled') throw httpError(400, `This interview is already ${interview.status}.`);
  interview.status = status;
  await application.save();

  if (status === 'cancelled') {
    const job = await Job.findById(application.job);
    if (job) notifyInterview({ application, job, interview, change: 'cancelled' });
  }
  return { application, interview: interviewView(interview) };
}

/** Upcoming (and recently past, still-open) interviews across the company, for the Interviews page. */
export async function listCompanyInterviews(employer) {
  const since = new Date(Date.now() - 24 * 3600000);
  const apps = await Application.find({
    company: employer.companyId,
    interviews: { $elemMatch: { status: 'scheduled', scheduledAt: { $gte: since } } }
  }).select('candidateName job interviews stage').populate('job', 'title').limit(500);

  const rows = [];
  for (const app of apps) {
    for (const interview of app.interviews) {
      if (interview.status !== 'scheduled' || interview.scheduledAt < since) continue;
      rows.push({
        ...interviewView(interview),
        applicationId: app._id,
        candidateName: app.candidateName,
        jobId: app.job?._id,
        jobTitle: app.job?.title || 'Job removed'
      });
    }
  }
  rows.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return { interviews: rows };
}
