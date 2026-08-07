import { Router } from 'express';
import * as recipes from '../controllers/recipes.js';
import * as recipesBulk from '../controllers/recipes-bulk.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Recipes resource (spec/api/foods-recipes.md §Recipes). All routes require auth and are
// scoped to the session user. Saving (re)builds the derived food + auto "portion".
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(recipes.list));
router.post('/preview', asyncHandler(recipes.preview));
router.post('/', asyncHandler(recipes.create));
// Literal paths before the parameterised ones, so neither can resolve as an id.
router.get('/ids', asyncHandler(recipesBulk.ids));
router.patch('/bulk', asyncHandler(recipesBulk.update));
router.post('/bulk/undo', asyncHandler(recipesBulk.undo));
router.get('/:id', asyncHandler(recipes.get));
router.patch('/:id', asyncHandler(recipes.update));
router.post('/:id/archive', asyncHandler(recipes.archive));
router.post('/:id/restore', asyncHandler(recipes.restore));

export default router;
