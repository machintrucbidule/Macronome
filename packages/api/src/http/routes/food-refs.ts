import { Router } from 'express';
import * as foodRefs from '../controllers/food-refs.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Ciqual reference catalog (spec/api/foods-recipes.md §Food reference catalog, B-292).
// Read-only: the Aliments screen's "Catalogue Ciqual" mode browses it, and adoption goes
// through the ordinary POST /foods with source:'ciqual' — nothing is written here.
const router = Router();

router.use(requireAuth);
// Declared before any parameterised path, so the literal never resolves as an id.
router.get('/groups', asyncHandler(foodRefs.groups));
router.get('/', asyncHandler(foodRefs.list));

export default router;
