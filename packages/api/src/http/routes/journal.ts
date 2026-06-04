import { Router } from 'express';
import * as journal from '../controllers/journal.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Journal read view (spec/api/days-meals-leftover.md §Journal). Auth-only, user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(journal.list));

export default router;
