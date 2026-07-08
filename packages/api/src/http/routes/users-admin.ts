import { Router } from 'express';
import * as accountTokens from '../controllers/account-tokens-admin.js';
import * as usersAdmin from '../controllers/users-admin.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';

// Admin user management (spec/api/users-admin.md, B-192) + token links
// (B-193/B-194). Admin-only: the role is re-read from the DB per request
// (non-admin → 403 forbidden). Literal paths registered before /:id.
const router = Router();

router.use(requireAuth);
router.use(requireAdmin);
router.get('/', asyncHandler(usersAdmin.list));
router.post('/invites', asyncHandler(accountTokens.createInvite));
router.get('/tokens', asyncHandler(accountTokens.listTokens));
router.delete('/tokens/:id', asyncHandler(accountTokens.revokeToken));
router.post('/:id/reset-token', asyncHandler(accountTokens.createResetToken));
router.patch('/:id', asyncHandler(usersAdmin.setRole));
router.delete('/:id', asyncHandler(usersAdmin.remove));

export default router;
