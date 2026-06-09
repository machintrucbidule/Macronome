import { Router } from 'express';
import * as ai from '../controllers/ai.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// AI uses resource (spec/api/ai.md). Each route backs one configured settings.ai task; calls the
// provider and persists nothing. Auth + user-scoped (config read from the authenticated user).
const router = Router();

router.use(requireAuth);
router.post('/dish-photo-macros', asyncHandler(ai.dishPhotoMacros));
router.post('/meal-suggestions', asyncHandler(ai.mealSuggestions));

export default router;
