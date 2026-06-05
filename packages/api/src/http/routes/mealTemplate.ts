import { Router } from 'express';
import * as template from '../controllers/mealTemplate.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Meal-template resource (spec/api §Settings). The ordered default day structure that seeds
// new days; editing it never edits already-created days. Auth + user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(template.list));
router.post('/', asyncHandler(template.create));
router.patch('/:id', asyncHandler(template.update));
router.delete('/:id', asyncHandler(template.remove));

export default router;
