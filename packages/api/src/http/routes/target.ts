import { Router } from 'express';
import * as targets from '../controllers/targets.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Targets & metabolic engine resource (spec/api/weight-targets-stats-settings.md
// §Targets). All routes require auth and are scoped to the session user.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(targets.get));
router.post('/', asyncHandler(targets.create));
router.post('/suggest', asyncHandler(targets.suggest));

export default router;
