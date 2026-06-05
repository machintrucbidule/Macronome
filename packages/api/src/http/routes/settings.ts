import { Router } from 'express';
import * as settings from '../controllers/settings.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// App-settings resource (spec/api/weight-targets-stats-settings.md §Settings). Locale,
// theme, the reserved llm_endpoint, and current_mode — stored on app_user.settings. Auth +
// user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(settings.get));
router.patch('/', asyncHandler(settings.patch));

export default router;
