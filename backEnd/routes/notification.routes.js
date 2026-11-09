import express from 'express';
import { listNotifications, markNotificationsRead } from '../services/inbox.services.js';
import { requireAuth, requireDatabase } from '../middlewares/auth.middlewares.js';

/** The signed-in user's in-app notifications. Mounted at /api/notifications. */
const router = express.Router();

router.use(requireDatabase, requireAuth);

router.get('/', async (req, res, next) => {
  try {
    res.json(await listNotifications(req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.post('/read', async (req, res, next) => {
  try {
    res.json(await markNotificationsRead(req.auth.sub, req.body?.ids));
  } catch (error) {
    next(error);
  }
});

export default router;
