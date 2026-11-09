import express from 'express';
import {
  getMyApplications, getMyResume, getMyWorkplace, postReferralInvite, postReferralLink, putMyResume
} from '../controllers/candidate.controllers.js';
import { requireAuth, requireCandidate, requireDatabase } from '../middlewares/auth.middlewares.js';
import { uploadMiddleware } from '../middlewares/upload.middlewares.js';

/** The signed-in candidate's own data. Mounted at /api/me. */
const router = express.Router();

router.use(requireDatabase, requireAuth, requireCandidate);

router.get('/resume', getMyResume);
router.put('/resume', uploadMiddleware.single('resume'), putMyResume);
router.get('/applications', getMyApplications);

// Employees of a company (matched by work email domain): internal jobs and referrals.
router.get('/workplace', getMyWorkplace);
router.post('/referrals/:jobId/link', postReferralLink);
router.post('/referrals/:jobId/invite', postReferralInvite);

export default router;
