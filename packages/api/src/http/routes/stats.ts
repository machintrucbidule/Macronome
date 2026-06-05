import { Router } from 'express';
import * as stats from '../controllers/stats.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Stats resource (spec/api/weight-targets-stats-settings.md §Stats). Read-only; all routes
// require auth and are scoped to the session user.
const router = Router();

router.use(requireAuth);
router.get('/rolling', asyncHandler(stats.rolling));
router.get('/adherence', asyncHandler(stats.adherence));

export default router;
