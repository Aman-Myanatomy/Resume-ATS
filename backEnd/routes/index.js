import express from 'express';
import authRoutes from './auth.routes.js';
import analysisRoutes from './analysis.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/analyses', analysisRoutes);
// Direct analyze route mapping for backward compatibility with frontend POST /api/analyze
router.use('/', analysisRoutes);

export default router;

