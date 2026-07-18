import { Router } from 'express';
import * as weight from '../controllers/weight.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Weight resource (spec/api/weight-targets-stats-settings.md §Weight). All routes require
// auth and are scoped to the session user.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(weight.get));
router.get('/interval-days', asyncHandler(weight.intervalDays));
router.post('/', asyncHandler(weight.create));
router.patch('/:id', asyncHandler(weight.patch));
router.delete('/:id', asyncHandler(weight.remove));

export default router;
