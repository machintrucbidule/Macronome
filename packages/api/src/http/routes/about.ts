import { Router } from 'express';
import * as about from '../controllers/about.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// About / system-info resource (spec/api/system-info.md). App version + server/runtime snapshot.
// Authenticated: it exposes host internals to the single owner only (the public readiness probe
// stays at /api/v1/health).
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(about.get));

export default router;
