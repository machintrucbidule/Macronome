import { Router } from 'express';
import * as foods from '../controllers/foods.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Foods resource (spec/api/foods-recipes.md §Foods). All routes require auth and
// are scoped to the session user. The combined food∪recipe `/search/loggable`
// endpoint is deferred to M5 (when the recipe table exists).
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(foods.list));
router.post('/', asyncHandler(foods.create));
router.post('/parse-label', foods.parseLabel); // sync handler — Express catches throws
router.get('/:id', asyncHandler(foods.get));
router.patch('/:id', asyncHandler(foods.update));
router.post('/:id/archive', asyncHandler(foods.archive));
router.post('/:id/restore', asyncHandler(foods.restore));

export default router;
