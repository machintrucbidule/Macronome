import { Router } from 'express';
import { env } from '../../config/env.js';
import { pingDb } from '../../data/health.js';
import { asyncHandler } from '../async-handler.js';

// GET /api/v1/health — no auth. Proves the proxy → api → db round-trip and reports the running
// app version (baked from the git tag at build, ADR-0002; 'dev' outside the image).
const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = await pingDb();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      db: db ? 'up' : 'down',
      version: env.APP_VERSION,
    });
  }),
);

export default router;
