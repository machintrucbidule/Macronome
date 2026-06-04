import { Router } from 'express';
import * as days from '../controllers/days.js';
import * as meals from '../controllers/meals.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Days + meals resource (spec/api/days-meals-leftover.md §Day, §Meals). All routes
// require auth and are scoped to the session user. Meals are this day's own slots,
// nested under the date; meal entries live under /meals (see routes/meals.ts).
const router = Router();

router.use(requireAuth);
router.get('/:date', asyncHandler(days.get));
router.post('/:date', asyncHandler(days.materialize));
router.patch('/:date', asyncHandler(days.patch));
router.post('/:date/meals', asyncHandler(meals.create));
router.patch('/:date/meals/:mealId', asyncHandler(meals.patch));
router.delete('/:date/meals/:mealId', asyncHandler(meals.remove));

export default router;
