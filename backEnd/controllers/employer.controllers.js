import { getCompanyById, removeCompanyLogo, setCompanyLogo, updateCompany } from '../services/company.services.js';
import { createJob, getEmployerJobDetail, listEmployerJobs, updateJob } from '../services/job.services.js';
import {
  addApplicationNote,
  applicationDetail,
  getApplicationForEmployer,
  listJobApplicants,
  rescoreApplication,
  updateApplicationStage
} from '../services/application.services.js';
import { downgradeToStarter, getBillingSummary, startCheckout, verifyPayment } from '../services/billing.services.js';
import { listCompanyInterviews, scheduleInterview, updateInterviewStatus } from '../services/interview.services.js';
import { generateJobDescription } from '../services/jobAi.services.js';
import { getEmployerOverview } from '../services/overview.services.js';
import { listCompanyReferrals } from '../services/workplace.services.js';
import { companyStages, updatePipelineStages } from '../services/pipeline.services.js';

/**
 * Employer Controller Layer
 * Every handler is scoped to req.employer.companyId (set by requireEmployer),
 * so one company can never read or change another company's data.
 */

const handle = fn => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

export const getCompany = handle(async (req, res) => {
  res.json({ company: await getCompanyById(req.employer.companyId) });
});

export const patchCompany = handle(async (req, res) => {
  res.json({ company: await updateCompany(req.employer.companyId, req.body || {}) });
});

export const putLogo = handle(async (req, res) => {
  res.json(await setCompanyLogo(req.employer.companyId, req.file));
});

export const deleteLogo = handle(async (req, res) => {
  res.json(await removeCompanyLogo(req.employer.companyId));
});

export const getOverview = handle(async (req, res) => {
  res.json(await getEmployerOverview(req.employer));
});

export const getJobs = handle(async (req, res) => {
  res.json({ jobs: await listEmployerJobs(req.employer.companyId) });
});

export const postJob = handle(async (req, res) => {
  const job = await createJob({ companyId: req.employer.companyId, userId: req.employer.userId, input: req.body || {} });
  res.status(201).json({ job });
});

export const postGenerateDescription = handle(async (req, res) => {
  res.json(await generateJobDescription({ input: req.body || {}, companyName: req.employer.company.name }));
});

export const getJob = handle(async (req, res) => {
  res.json({ job: await getEmployerJobDetail(req.params.id, req.employer.companyId) });
});

export const patchJob = handle(async (req, res) => {
  res.json({ job: await updateJob({ jobId: req.params.id, companyId: req.employer.companyId, input: req.body || {} }) });
});

export const getApplicants = handle(async (req, res) => {
  res.json(await listJobApplicants({
    jobId: req.params.id,
    companyId: req.employer.companyId,
    stage: req.query.stage,
    source: req.query.source,
    sort: req.query.sort
  }));
});

export const putPipeline = handle(async (req, res) => {
  res.json({ pipelineStages: await updatePipelineStages(req.employer.companyId, req.body?.stages) });
});

export const getReferrals = handle(async (req, res) => {
  res.json(await listCompanyReferrals(req.employer.companyId));
});

export const getApplication = handle(async (req, res) => {
  res.json(await getApplicationForEmployer(req.params.id, req.employer.companyId));
});

export const patchApplication = handle(async (req, res) => {
  res.json(await updateApplicationStage({
    applicationId: req.params.id,
    companyId: req.employer.companyId,
    userId: req.employer.userId,
    stage: req.body?.stage
  }));
});

export const postNote = handle(async (req, res) => {
  res.status(201).json(await addApplicationNote({
    applicationId: req.params.id,
    companyId: req.employer.companyId,
    userId: req.employer.userId,
    authorName: req.employer.name,
    text: req.body?.text
  }));
});

export const postRescore = handle(async (req, res) => {
  res.json(await rescoreApplication({ applicationId: req.params.id, companyId: req.employer.companyId }));
});

// ---------- Interviews ----------

export const postInterview = handle(async (req, res) => {
  const { application, interview, stageMoved } = await scheduleInterview(req.employer, req.params.id, req.body || {});
  res.status(201).json({ application: applicationDetail(application, companyStages(req.employer.company)), interview, stageMoved });
});

export const patchInterview = handle(async (req, res) => {
  const { application, interview } = await updateInterviewStatus(req.employer, req.params.id, req.params.interviewId, req.body?.status);
  res.json({ application: applicationDetail(application, companyStages(req.employer.company)), interview });
});

export const getInterviews = handle(async (req, res) => {
  res.json(await listCompanyInterviews(req.employer));
});

// ---------- Billing ----------

export const getBilling = handle(async (req, res) => {
  res.json(await getBillingSummary(req.employer.company));
});

export const postCheckout = handle(async (req, res) => {
  res.json(await startCheckout(req.employer.company, { planId: req.body?.plan, userId: req.employer.userId }));
});

export const postVerifyPayment = handle(async (req, res) => {
  const { orderId, paymentId, signature } = req.body || {};
  res.json(await verifyPayment(req.employer.company, { orderId, paymentId, signature, userId: req.employer.userId }));
});

export const postDowngrade = handle(async (req, res) => {
  res.json(await downgradeToStarter(req.employer.company));
});
