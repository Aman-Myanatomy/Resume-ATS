import crypto from 'crypto';
import Company from '../models/company.models.js';
import Job from '../models/job.models.js';
import User from '../models/user.models.js';
import Application from '../models/application.models.js';
import Referral, { REFERRAL_RELATIONSHIPS } from '../models/referral.models.js';
import { appUrl, queueEmail, renderEmail } from './email.services.js';
import { pushNotification } from './inbox.services.js';
import { stageKind, stageLabel, stagesForCompany } from './pipeline.services.js';
import { assertObjectId, httpError } from '../utils/http.utils.js';

/**
 * Employees, internal jobs and referrals.
 *
 * Resumely has one employer account per company (the hiring owner). Everyone else at the company
 * uses a normal job seeker account with their work email. A job seeker whose email domain is in the
 * company's `emailDomains` is treated as an employee of that company: they can see and apply to
 * internal jobs, and refer people for the company's external jobs.
 */

// Free email providers can never be claimed as a company domain.
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'rediffmail.com', 'zoho.com',
  'zohomail.in', 'gmx.com', 'mail.com', 'yandex.com'
]);

const DOMAIN_RE = /^(?=.{3,120}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export const RELATIONSHIP_LABELS = {
  former_colleague: 'Former colleague',
  friend: 'Friend',
  classmate: 'Classmate',
  family: 'Family',
  professional_network: 'Professional network',
  other: 'Other'
};

export function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  return at === -1 ? '' : String(email).slice(at + 1).trim().toLowerCase();
}

/** Validates the employer's list of work email domains. Accepts an array or a comma separated string. */
export async function normalizeEmailDomains(input, companyId) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
  const domains = [...new Set(raw
    .map(d => String(d).trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean))];
  if (domains.length > 5) throw httpError(400, 'Add up to 5 email domains.');
  for (const domain of domains) {
    if (!DOMAIN_RE.test(domain)) throw httpError(400, `"${domain}" is not a valid email domain. Use something like yourcompany.com.`);
    if (PUBLIC_EMAIL_DOMAINS.has(domain)) throw httpError(400, `${domain} is a public email provider. Use your company's own domain.`);
  }
  if (domains.length) {
    const taken = await Company.findOne({ _id: { $ne: companyId }, emailDomains: { $in: domains } }).select('emailDomains');
    if (taken) {
      const clash = domains.find(d => taken.emailDomains.includes(d));
      throw httpError(409, `${clash} is already used by another company on Resumely. Contact support if this is your domain.`);
    }
  }
  return domains;
}

/** Companies where this user is an employee (by work email domain). Employer accounts are never employees. */
export async function employeeCompaniesFor(user) {
  if (!user || user.role !== 'candidate') return [];
  const domain = emailDomain(user.email);
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return [];
  return Company.find({ emailDomains: domain }).select('name slug emailDomains logo.url logo.version');
}

export async function isEmployeeOf(user, companyId) {
  const companies = await employeeCompaniesFor(user);
  return companies.some(c => String(c._id) === String(companyId));
}

function newCode() {
  return crypto.randomBytes(6).toString('base64url');
}

function referralLinkUrl(job, code) {
  return appUrl(`/jobs/${job._id}?ref=${code}`);
}

async function loadEmployee(userId) {
  const user = await User.findById(userId).select('name email role');
  if (!user) throw httpError(401, 'Please sign in again.');
  return user;
}

/** An open, external job at the employee's company that accepts referrals. */
async function loadReferableJob(user, jobId) {
  assertObjectId(jobId, 'Job');
  const job = await Job.findById(jobId);
  if (!job || job.status === 'draft') throw httpError(404, 'Job not found.');
  if (!(await isEmployeeOf(user, job.company))) {
    throw httpError(403, `Only ${job.companyName} employees can refer for this job. Sign in with your work email.`);
  }
  if (job.visibility === 'internal') throw httpError(400, 'Internal jobs are for current employees to apply to directly, not referrals.');
  if (job.referralsEnabled === false) throw httpError(400, 'Referrals are turned off for this job.');
  if (job.status !== 'open') throw httpError(410, 'This job is no longer accepting applications.');
  return job;
}

/** The employee's personal referral link for a job (created on first use). */
export async function getReferralLink(userId, jobId) {
  const user = await loadEmployee(userId);
  const job = await loadReferableJob(user, jobId);
  let link = await Referral.findOne({ job: job._id, referrer: user._id, kind: 'link' });
  if (!link) {
    link = await Referral.create({
      company: job.company, job: job._id, referrer: user._id, referrerName: user.name, referrerEmail: user.email,
      kind: 'link', code: newCode(), status: 'invited'
    });
  }
  return { code: link.code, url: referralLinkUrl(job, link.code), applications: link.applications.length };
}

/** The employee refers a specific person by email. The person gets an email with a personal apply link. */
export async function inviteReferral(userId, jobId, input = {}) {
  const user = await loadEmployee(userId);
  const job = await loadReferableJob(user, jobId);

  const candidateName = String(input.candidateName || '').trim().slice(0, 120);
  const candidateEmail = String(input.candidateEmail || '').trim().toLowerCase().slice(0, 200);
  const relationship = REFERRAL_RELATIONSHIPS.includes(input.relationship) ? input.relationship : '';
  const note = String(input.note || '').trim().slice(0, 1000);

  if (candidateName.length < 2) throw httpError(400, "Add the person's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) throw httpError(400, 'Add a valid email address for the person you are referring.');
  if (candidateEmail === user.email.toLowerCase()) throw httpError(400, "You can't refer yourself. Apply directly instead.");
  if (!relationship) throw httpError(400, 'Choose how you know this person.');

  const existing = await Referral.findOne({ job: job._id, candidateEmail, kind: 'invite' });
  if (existing) {
    throw httpError(409, String(existing.referrer) === String(user._id)
      ? 'You have already referred this person for this job.'
      : 'This person has already been referred for this job by a colleague.');
  }
  const applicant = await User.findOne({ email: candidateEmail }).select('_id');
  if (applicant && await Application.exists({ job: job._id, candidate: applicant._id })) {
    throw httpError(409, 'This person has already applied to this job.');
  }

  const referral = await Referral.create({
    company: job.company, job: job._id, referrer: user._id, referrerName: user.name, referrerEmail: user.email,
    kind: 'invite', code: newCode(), candidateName, candidateEmail, relationship, note, status: 'invited'
  });

  const url = referralLinkUrl(job, referral.code);
  const { html, text } = renderEmail({
    heading: `${user.name} referred you for ${job.title} at ${job.companyName}`,
    lines: [
      `Hi ${candidateName.split(' ')[0]},`,
      `${user.name} works at ${job.companyName} and thinks you'd be a great fit for the ${job.title} role (job ID ${job.jobCode}).`,
      'Apply through the link below so your application is marked as a referral and reaches the hiring team with their recommendation.'
    ],
    details: [['Role', job.title], ['Job ID', job.jobCode], ['Location', job.location || 'Remote'], ['Note from ' + user.name.split(' ')[0], note]],
    cta: { label: 'View job and apply', url },
    footer: 'You got this email because an employee of this company referred you on Resumely.'
  });
  queueEmail({ to: candidateEmail, subject: `${user.name} referred you: ${job.title} at ${job.companyName}`, html, text });

  return { referral: referralView(referral, job) };
}

function referralView(r, job, application, stages) {
  return {
    id: r._id,
    kind: r.kind,
    code: r.code,
    job: job ? { id: job._id, title: job.title, jobCode: job.jobCode, status: job.status } : null,
    candidateName: r.candidateName || '',
    candidateEmail: r.candidateEmail || '',
    relationship: r.relationship || '',
    note: r.note || '',
    status: r.status,
    applicationCount: r.applications?.length || 0,
    // What the referrer may see about progress: never the score or private notes.
    applicationStage: application ? (application.stage === 'rejected' ? 'not_selected' : application.stage) : null,
    applicationStageLabel: application && stages ? (application.stage === 'rejected' ? 'Not moving forward' : stageLabel(stages, application.stage)) : null,
    applicationStageKind: application && stages ? (application.stage === 'rejected' ? 'not_selected' : stageKind(stages, application.stage)) : null,
    createdAt: r.createdAt
  };
}

function workplaceJob(job, extra = {}) {
  return {
    id: job._id,
    jobCode: job.jobCode,
    title: job.title,
    department: job.department || '',
    team: job.team || '',
    project: job.project || '',
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax ?? null,
    visibility: job.visibility || 'external',
    referralBonus: job.referralBonus || '',
    openings: job.openings || 1,
    publishedAt: job.publishedAt,
    ...extra
  };
}

/**
 * Everything an employee needs on their "My company" page: internal openings, external jobs they
 * can refer for, and the referrals they have made. Returns { company: null } for non-employees.
 */
export async function getWorkplace(userId) {
  const user = await loadEmployee(userId);
  const [company] = await employeeCompaniesFor(user);
  if (!company) return { company: null, domain: emailDomain(user.email) };

  const [stages, jobs, referrals, myApplications] = await Promise.all([
    stagesForCompany(company._id),
    Job.find({ company: company._id, status: 'open' }).sort({ publishedAt: -1 }).limit(100),
    Referral.find({ referrer: user._id, company: company._id }).sort({ createdAt: -1 }).limit(200),
    Application.find({ candidate: user._id, company: company._id }).select('job')
  ]);
  const appliedJobIds = new Set(myApplications.map(a => String(a.job)));
  const jobById = new Map(jobs.map(j => [String(j._id), j]));

  // Load jobs for referrals whose job is no longer open, plus the credited applications' stages.
  const missingJobIds = referrals.map(r => String(r.job)).filter(id => !jobById.has(id));
  if (missingJobIds.length) {
    for (const j of await Job.find({ _id: { $in: missingJobIds } })) jobById.set(String(j._id), j);
  }
  const appIds = referrals.flatMap(r => r.applications);
  const apps = appIds.length ? await Application.find({ _id: { $in: appIds } }).select('stage candidateName') : [];
  const appById = new Map(apps.map(a => [String(a._id), a]));

  const links = new Map(referrals.filter(r => r.kind === 'link').map(r => [String(r.job), r]));
  const invites = referrals.filter(r => r.kind === 'invite');

  // People who applied through the employee's links (not individually invited).
  const linkApplicants = referrals.filter(r => r.kind === 'link').flatMap(r => r.applications.map(id => {
    const app = appById.get(String(id));
    if (!app) return null;
    return {
      id: `${r._id}-${id}`, kind: 'link', job: referralView(r, jobById.get(String(r.job))).job,
      candidateName: app.candidateName, candidateEmail: '', relationship: '', note: '', status: 'applied',
      applicationStage: app.stage === 'rejected' ? 'not_selected' : app.stage,
      applicationStageLabel: app.stage === 'rejected' ? 'Not moving forward' : stageLabel(stages, app.stage),
      applicationStageKind: app.stage === 'rejected' ? 'not_selected' : stageKind(stages, app.stage),
      createdAt: r.createdAt
    };
  })).filter(Boolean);

  const myReferrals = [
    ...invites.map(r => referralView(r, jobById.get(String(r.job)), appById.get(String(r.applications[0])), stages)),
    ...linkApplicants
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const internalJobs = jobs.filter(j => j.visibility === 'internal')
    .map(j => workplaceJob(j, { applied: appliedJobIds.has(String(j._id)) }));
  const referralJobs = jobs.filter(j => j.visibility !== 'internal' && j.referralsEnabled !== false)
    .map(j => {
      const link = links.get(String(j._id));
      return workplaceJob(j, {
        referralLink: link ? referralLinkUrl(j, link.code) : null,
        referred: invites.filter(r => String(r.job) === String(j._id)).length + (link?.applications.length || 0)
      });
    });

  return {
    company: { id: company._id, name: company.name, slug: company.slug, logoUrl: company.logo?.url || null },
    domain: emailDomain(user.email),
    internalJobs,
    referralJobs,
    referrals: myReferrals,
    stats: {
      referred: myReferrals.length,
      applied: myReferrals.filter(r => r.status === 'applied').length,
      interviewing: myReferrals.filter(r => ['assessment', 'interview', 'offer'].includes(r.applicationStageKind)).length,
      hired: myReferrals.filter(r => r.applicationStageKind === 'hired').length
    }
  };
}

/**
 * Works out how an application should be credited when a candidate applies.
 * - Employees of the hiring company are always 'internal' (no referral credit to themselves).
 * - A valid ?ref= code for this job credits the referrer.
 * - Otherwise an earlier email invite to this candidate's email credits that referrer.
 * Returns { source, referral, referralDoc }.
 */
export async function resolveApplicationSource({ job, user, refCode }) {
  if (await isEmployeeOf(user, job.company)) return { source: 'internal', referral: undefined, referralDoc: null };
  if (job.visibility === 'internal' || job.referralsEnabled === false) return { source: 'direct', referral: undefined, referralDoc: null };

  let doc = null;
  if (refCode && /^[A-Za-z0-9_-]{4,32}$/.test(String(refCode))) {
    doc = await Referral.findOne({ code: String(refCode), job: job._id });
    // Referrers can't credit themselves (they'd be 'internal' anyway; this also guards ex-employees).
    if (doc && String(doc.referrer) === String(user._id)) doc = null;
  }
  if (!doc) {
    doc = await Referral.findOne({ job: job._id, kind: 'invite', candidateEmail: user.email.toLowerCase(), status: 'invited' });
  }
  if (!doc) return { source: 'direct', referral: undefined, referralDoc: null };

  return {
    source: 'referral',
    referralDoc: doc,
    referral: {
      referralId: doc._id,
      referrer: doc.referrer,
      referrerName: doc.referrerName,
      referrerEmail: doc.referrerEmail,
      relationship: doc.relationship ? RELATIONSHIP_LABELS[doc.relationship] : '',
      note: doc.note || ''
    }
  };
}

/** After the application is saved: link it to the referral and tell the referrer. Never throws. */
export async function recordReferralApplication({ referralDoc, application, job }) {
  if (!referralDoc) return;
  try {
    await Referral.updateOne(
      { _id: referralDoc._id },
      { $addToSet: { applications: application._id }, status: 'applied' }
    );
    await pushNotification(referralDoc.referrer, {
      type: 'referral_applied',
      title: `${application.candidateName} applied through your referral`,
      body: `${job.title} (${job.jobCode})`,
      link: '/app/workplace'
    });
  } catch (error) {
    console.error('Could not record referral:', error.message);
  }
}

// ---------- Employer view ----------

/** All referrals for the employer's company, newest first, with the referred candidate's stage. */
export async function listCompanyReferrals(companyId) {
  const [stages, referrals, referredApps] = await Promise.all([
    stagesForCompany(companyId),
    Referral.find({ company: companyId, kind: 'invite' }).sort({ createdAt: -1 }).limit(500),
    Application.find({ company: companyId, source: 'referral' }).sort({ createdAt: -1 }).limit(500)
      .select('job candidateName candidateEmail stage score scoreStatus referral createdAt')
  ]);
  const jobIds = [...new Set([...referrals.map(r => String(r.job)), ...referredApps.map(a => String(a.job))])];
  const jobs = new Map((await Job.find({ _id: { $in: jobIds } }).select('title jobCode status referralBonus'))
    .map(j => [String(j._id), j]));
  const jobView = id => {
    const j = jobs.get(String(id));
    return j ? { id: j._id, title: j.title, jobCode: j.jobCode, status: j.status, referralBonus: j.referralBonus || '' } : null;
  };

  const appliedInviteIds = new Set(referredApps.map(a => String(a.referral?.referralId)));
  const rows = [
    ...referredApps.map(a => ({
      id: a._id,
      status: 'applied',
      job: jobView(a.job),
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      referrerName: a.referral?.referrerName || '',
      referrerEmail: a.referral?.referrerEmail || '',
      relationship: a.referral?.relationship || '',
      note: a.referral?.note || '',
      applicationId: a._id,
      stage: a.stage,
      stageLabel: stageLabel(stages, a.stage),
      stageKind: stageKind(stages, a.stage),
      score: a.score,
      scoreStatus: a.scoreStatus,
      createdAt: a.createdAt
    })),
    // Invites the candidate hasn't acted on yet.
    ...referrals.filter(r => !appliedInviteIds.has(String(r._id)) && r.status === 'invited').map(r => ({
      id: r._id,
      status: 'invited',
      job: jobView(r.job),
      candidateName: r.candidateName,
      candidateEmail: r.candidateEmail,
      referrerName: r.referrerName,
      referrerEmail: r.referrerEmail,
      relationship: r.relationship ? RELATIONSHIP_LABELS[r.relationship] : '',
      note: r.note || '',
      applicationId: null,
      stage: null,
      stageLabel: null,
      stageKind: null,
      score: null,
      scoreStatus: null,
      createdAt: r.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const referrers = new Map();
  for (const r of rows) {
    const key = r.referrerEmail || r.referrerName;
    if (!key) continue;
    const entry = referrers.get(key) || { name: r.referrerName, email: r.referrerEmail, referred: 0, applied: 0, hired: 0 };
    entry.referred += 1;
    if (r.status === 'applied') entry.applied += 1;
    if (r.stageKind === 'hired') entry.hired += 1;
    referrers.set(key, entry);
  }

  return {
    referrals: rows,
    stats: {
      total: rows.length,
      applied: rows.filter(r => r.status === 'applied').length,
      invited: rows.filter(r => r.status === 'invited').length,
      interviewing: rows.filter(r => ['assessment', 'interview', 'offer'].includes(r.stageKind)).length,
      hired: rows.filter(r => r.stageKind === 'hired').length
    },
    topReferrers: [...referrers.values()].sort((a, b) => b.applied - a.applied || b.referred - a.referred).slice(0, 5)
  };
}
