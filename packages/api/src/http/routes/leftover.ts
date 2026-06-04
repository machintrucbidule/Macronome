import { Router } from 'express';
import * as leftover from '../controllers/leftover.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Leftover re-edit / delete resource (spec/api/days-meals-leftover.md §Leftover). The
// per-meal create lives under /meals (routes/meals.ts); these operate on an existing
// group by id. All routes require auth and are scoped to the session user.
const router = Router();

router.use(requireAuth);
router.patch('/:groupId', asyncHandler(leftover.update));
router.delete('/:groupId', asyncHandler(leftover.remove));

export default router;
