import { Router } from 'express';
import * as foods from '../controllers/foods.js';
import * as foodsBulk from '../controllers/foods-bulk.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Foods resource (spec/api/foods-recipes.md §Foods). All routes require auth and are scoped to
// the session user. The combined food ∪ recipe ∪ Ciqual search lives on its own router
// (`routes/search.ts` → `/search/loggable`).
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(foods.list));
router.post('/', asyncHandler(foods.create));
router.post('/parse-label', foods.parseLabel); // sync handler — Express catches throws
// Literal paths before the parameterised ones, so neither can resolve as an id.
router.post('/from-ref', asyncHandler(foods.createFromRef));
router.get('/ids', asyncHandler(foodsBulk.ids));
router.patch('/bulk', asyncHandler(foodsBulk.update));
router.post('/bulk/undo', asyncHandler(foodsBulk.undo));
router.get('/:id', asyncHandler(foods.get));
router.patch('/:id', asyncHandler(foods.update));
router.post('/:id/archive', asyncHandler(foods.archive));
router.post('/:id/restore', asyncHandler(foods.restore));

export default router;
