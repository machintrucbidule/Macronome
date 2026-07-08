import { Router } from 'express';
import * as auth from '../controllers/auth.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rateLimit.js';

// Auth resource (spec/api/00-conventions.md §7). CSRF is applied globally;
// login is additionally rate-limited / lockout-protected.
const router = Router();

router.get('/setup-state', asyncHandler(auth.setupState));
router.post('/setup', loginRateLimit, asyncHandler(auth.setup));
router.post('/login', loginRateLimit, asyncHandler(auth.login));
// Token-link flows (B-193/B-194). register keys the limiter on username|ip like
// login; reset-password has no username so the key degrades to ip-only — fine,
// the 2^256 token space is the real defence. The state probe is unlimited.
router.post('/token-state', asyncHandler(auth.tokenState));
router.post('/register', loginRateLimit, asyncHandler(auth.register));
router.post('/reset-password', loginRateLimit, asyncHandler(auth.resetPassword));
router.post('/logout', asyncHandler(auth.logout));
router.get('/session', asyncHandler(auth.session));
router.post('/password', requireAuth, asyncHandler(auth.changePassword));

export default router;
