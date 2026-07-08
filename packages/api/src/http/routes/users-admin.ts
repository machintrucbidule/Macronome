import { Router } from 'express';
import * as usersAdmin from '../controllers/users-admin.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';

// Admin user management (spec/api/users-admin.md, B-192). Admin-only: the role
// is re-read from the DB per request (non-admin → 403 forbidden).
const router = Router();

router.use(requireAuth);
router.use(requireAdmin);
router.get('/', asyncHandler(usersAdmin.list));
router.patch('/:id', asyncHandler(usersAdmin.setRole));
router.delete('/:id', asyncHandler(usersAdmin.remove));

export default router;
