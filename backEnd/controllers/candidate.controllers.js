import { getSavedResume, listMyApplications, saveResume } from '../services/application.services.js';
import { getReferralLink, getWorkplace, inviteReferral } from '../services/workplace.services.js';

/**
 * Candidate Controller Layer
 * The signed-in job seeker's saved resume and applications.
 */

export async function getMyResume(req, res, next) {
  try {
    res.json(await getSavedResume(req.auth.sub));
  } catch (error) {
    next(error);
  }
}

export async function putMyResume(req, res, next) {
  try {
    res.json(await saveResume(req.auth.sub, { file: req.file, text: req.body?.text }));
  } catch (error) {
    next(error);
  }
}

export async function getMyApplications(req, res, next) {
  try {
    res.json({ applications: await listMyApplications(req.auth.sub) });
  } catch (error) {
    next(error);
  }
}

/** Employees: internal jobs, jobs to refer for, and their referrals. { company: null } for everyone else. */
export async function getMyWorkplace(req, res, next) {
  try {
    res.json(await getWorkplace(req.auth.sub));
  } catch (error) {
    next(error);
  }
}

export async function postReferralLink(req, res, next) {
  try {
    res.json(await getReferralLink(req.auth.sub, req.params.jobId));
  } catch (error) {
    next(error);
  }
}

export async function postReferralInvite(req, res, next) {
  try {
    res.status(201).json(await inviteReferral(req.auth.sub, req.params.jobId, req.body || {}));
  } catch (error) {
    next(error);
  }
}
