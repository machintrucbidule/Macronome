import { Router } from 'express';
import { pingDb } from '../../data/health.js';
import { asyncHandler } from '../async-handler.js';

// GET /api/v1/health — no auth. Proves the proxy → api → db round-trip.
const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = await pingDb();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db: db ? 'up' : 'down' });
  }),
);

export default router;
