import express from 'express';
import { listJobs, getJob, getCompanyPage, fitCheck, apply, companyLogo, listPlans, publicStats } from '../controllers/job.controllers.js';
import { optionalAuth, requireAuth, requireCandidate, requireDatabase } from '../middlewares/auth.middlewares.js';
import { uploadMiddleware } from '../middlewares/upload.middlewares.js';
import { aiLimiter } from '../config/security.config.js';

/** Public job board + candidate actions on a job. Mounted at /api. */
const router = express.Router();

router.use(['/jobs', '/companies', '/stats'], requireDatabase);

router.get('/plans', listPlans);
router.get('/stats', publicStats);
router.get('/jobs', listJobs);
router.get('/jobs/:id', optionalAuth, getJob);
router.get('/companies/:slug', getCompanyPage);
router.get('/companies/:slug/logo', companyLogo);

router.post('/jobs/:id/fit', requireAuth, requireCandidate, aiLimiter, uploadMiddleware.single('resume'), fitCheck);
router.post('/jobs/:id/apply', requireAuth, requireCandidate, aiLimiter, uploadMiddleware.single('resume'), apply);

export default router;
