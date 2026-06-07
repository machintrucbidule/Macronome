import { Router } from 'express';
import * as targets from '../controllers/targets.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Target history resource (TH-1 / B-091; spec/api/weight-targets-stats-settings.md
// §Targets). The singular /target router keeps the current-target readout; this plural
// /targets router manages the versioned history. All routes require auth, user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(targets.list));
router.get('/:id/recompute-count', asyncHandler(targets.recomputeCount));
router.post('/:id/recompute', asyncHandler(targets.recompute));
router.patch('/:id', asyncHandler(targets.patch));
router.delete('/:id', asyncHandler(targets.remove));

export default router;
