import { searchPublicJobs, getPublicJob, getOpenJobsForCompany } from '../services/job.services.js';
import { getCompanyLogo, getPublicCompanyBySlug } from '../services/company.services.js';
import { PLANS } from '../config/plans.config.js';
import Job from '../models/job.models.js';
import Company from '../models/company.models.js';
import { applyToJob, checkFit, getMyJobStatus } from '../services/application.services.js';
import { parseJsonField } from '../utils/http.utils.js';

/**
 * Job Board Controller Layer
 * Public job search plus candidate actions on a job (fit check, apply).
 */

export async function listJobs(req, res, next) {
  try {
    res.json(await searchPublicJobs(req.query));
  } catch (error) {
    next(error);
  }
}

export async function getJob(req, res, next) {
  try {
    const data = await getPublicJob(req.params.id, req.auth?.sub);
    // Signed-in visitors also get their own status for this job.
    const me = req.auth?.sub ? await getMyJobStatus(req.auth.sub, data.job.id, data.companyId) : null;
    delete data.companyId;
    res.json({ ...data, me });
  } catch (error) {
    next(error);
  }
}

export async function getCompanyPage(req, res, next) {
  try {
    const company = await getPublicCompanyBySlug(req.params.slug);
    const jobs = await getOpenJobsForCompany(company.id);
    res.json({ company, jobs });
  } catch (error) {
    next(error);
  }
}

export async function companyLogo(req, res, next) {
  try {
    const { data, mimeType, redirect } = await getCompanyLogo(req.params.slug);
    if (redirect) return res.redirect(302, redirect);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'"
    });
    res.send(data);
  } catch (error) {
    next(error);
  }
}

/** Public plan list for the pricing page. */
export function listPlans(req, res) {
  res.json({ plans: Object.values(PLANS).map(p => ({ id: p.id, name: p.name, price: p.price, limits: p.limits, features: p.features })) });
}

/** Live numbers for the landing page. */
export async function publicStats(req, res, next) {
  try {
    const [openJobs, companies] = await Promise.all([
      Job.countDocuments({ status: 'open', visibility: { $ne: 'internal' } }),
      Company.countDocuments({})
    ]);
    res.json({ openJobs, companies });
  } catch (error) {
    next(error);
  }
}

export async function fitCheck(req, res, next) {
  try {
    const { text } = req.body || {};
    res.json(await checkFit({ jobId: req.params.id, userId: req.auth.sub, file: req.file, text }));
  } catch (error) {
    next(error);
  }
}

export async function apply(req, res, next) {
  try {
    const { text, coverNote, ref } = req.body || {};
    const answers = parseJsonField(req.body?.answers, []);
    const result = await applyToJob({ jobId: req.params.id, userId: req.auth.sub, file: req.file, text, coverNote, answers, refCode: ref });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
