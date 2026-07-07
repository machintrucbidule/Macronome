import { Router } from 'express';
import * as entries from '../controllers/entries.js';
import * as leftover from '../controllers/leftover.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Meal entries + leftover-create resource (spec/api/days-meals-leftover.md §Meal entries,
// §Leftover). Entries and the per-meal leftover apply hang off /meals/:mealId. The pin/unpin
// endpoints edit the line's garde-manger pantry_item (the live source of truth) and run the
// pin/unpin cascades (spec/logic/pantry-pin.md, B-045). All routes require auth (user-scoped).
const router = Router();

router.use(requireAuth);
router.post('/:mealId/entries', asyncHandler(entries.create));
// `entries/order` must precede `entries/:id` so it isn't captured as an id.
router.patch('/:mealId/entries/order', asyncHandler(entries.reorder));
router.patch('/:mealId/entries/:id', asyncHandler(entries.update));
router.delete('/:mealId/entries/:id', asyncHandler(entries.remove));
router.post('/:mealId/entries/:id/pin', asyncHandler(entries.pin));
router.post('/:mealId/entries/:id/unpin', asyncHandler(entries.unpin));
router.post('/:mealId/entries/:id/move', asyncHandler(entries.move));
// `leftover/preview` must precede the create route so it isn't shadowed.
router.post('/:mealId/leftover/preview', asyncHandler(leftover.preview));
router.post('/:mealId/leftover', asyncHandler(leftover.create));

export default router;
