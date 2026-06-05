import { Router } from 'express';
import * as containers from '../controllers/containers.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Containers (tares) resource (spec/api §Settings, spec/screens/containers.md). CRUD over
// the tare catalog; the locked built-in "Rien" rejects edit/delete. Auth + user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(containers.list));
router.post('/', asyncHandler(containers.create));
router.patch('/:id', asyncHandler(containers.update));
router.delete('/:id', asyncHandler(containers.remove));

export default router;
