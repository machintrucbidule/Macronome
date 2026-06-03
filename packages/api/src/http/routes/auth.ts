import { Router } from 'express';
import * as auth from '../controllers/auth.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rateLimit.js';

// Auth resource (spec/api/00-conventions.md §7). CSRF is applied globally;
// login is additionally rate-limited / lockout-protected.
const router = Router();

router.post('/login', loginRateLimit, asyncHandler(auth.login));
router.post('/logout', asyncHandler(auth.logout));
router.get('/session', asyncHandler(auth.session));
router.post('/password', requireAuth, asyncHandler(auth.changePassword));

export default router;
