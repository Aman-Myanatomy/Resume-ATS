import express from 'express';
import {
  getCompany, patchCompany, putLogo, deleteLogo, putPipeline,
  getJobs, getOverview, getReferrals, postJob, getJob, patchJob, getApplicants, postGenerateDescription,
  getApplication, patchApplication, postNote, postRescore,
  postInterview, patchInterview, getInterviews,
  getBilling, postCheckout, postVerifyPayment, postDowngrade
} from '../controllers/employer.controllers.js';
import { requireAuth, requireCompanyAdmin, requireDatabase, requireEmployer } from '../middlewares/auth.middlewares.js';
import { logoUploadMiddleware } from '../middlewares/upload.middlewares.js';
import { aiLimiter } from '../config/security.config.js';

/** Employer ATS. Mounted at /api/employer. */
const router = express.Router();

router.use(requireDatabase, requireAuth, requireEmployer);

router.get('/company', getCompany);
router.patch('/company', requireCompanyAdmin, patchCompany);
router.put('/company/logo', requireCompanyAdmin, logoUploadMiddleware.single('logo'), putLogo);
router.delete('/company/logo', requireCompanyAdmin, deleteLogo);
router.put('/company/pipeline', requireCompanyAdmin, putPipeline);

router.get('/overview', getOverview);
router.get('/jobs', getJobs);
router.post('/jobs', postJob);
// AI writer for the job form. Counts against the per-user hourly AI limit.
router.post('/jobs/generate-description', aiLimiter, postGenerateDescription);
router.get('/jobs/:id', getJob);
router.patch('/jobs/:id', patchJob);
router.get('/jobs/:id/applications', getApplicants);

router.get('/applications/:id', getApplication);
router.patch('/applications/:id', patchApplication);
router.post('/applications/:id/notes', postNote);
router.post('/applications/:id/rescore', postRescore);
router.post('/applications/:id/interviews', postInterview);
router.patch('/applications/:id/interviews/:interviewId', patchInterview);
router.get('/interviews', getInterviews);
router.get('/referrals', getReferrals);

// Plan and usage. Changing or paying is limited to the company owner/admin (MVP: the single account owner).
router.get('/billing', getBilling);
router.post('/billing/checkout', requireCompanyAdmin, postCheckout);
router.post('/billing/verify', requireCompanyAdmin, postVerifyPayment);
router.post('/billing/downgrade', requireCompanyAdmin, postDowngrade);

export default router;
