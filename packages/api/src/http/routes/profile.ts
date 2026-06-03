import { Router } from 'express';
import * as profile from '../controllers/profile.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Metabolic-profile resource (spec/api/weight-targets-stats-settings.md §"GET/PATCH
// /profile"). Edited on the Cibles screen; feeds the engine. Auth + user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(profile.get));
router.patch('/', asyncHandler(profile.patch));

export default router;
