import { Router } from 'express';
import * as ai from '../controllers/ai.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// AI uses resource (spec/api/ai.md). Each route backs one configured settings.ai task. The first two
// persist nothing; advice (B-202) archives its reply. Auth + user-scoped (config + rows read from the
// authenticated user).
const router = Router();

router.use(requireAuth);
router.post('/dish-photo-macros', asyncHandler(ai.dishPhotoMacros));
router.post('/meal-suggestions', asyncHandler(ai.mealSuggestions));
router.post('/advice', asyncHandler(ai.generateAdvice));
router.get('/advice', asyncHandler(ai.listAdvice));
router.delete('/advice/:id', asyncHandler(ai.deleteAdvice));

export default router;
