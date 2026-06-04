import { Router } from 'express';
import * as search from '../controllers/search.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Combined log search (spec/api/foods-recipes.md §"Combined log search"). The Daily log,
// cook mode and recipe ingredient picker query foods ∪ recipe-derived foods here.
const router = Router();

router.use(requireAuth);
router.get('/loggable', asyncHandler(search.loggable));

export default router;
