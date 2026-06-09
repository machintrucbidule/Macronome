import { Router } from 'express';
import * as settings from '../controllers/settings.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// App-settings resource (spec/api/weight-targets-stats-settings.md §Settings). Locale,
// theme, the AI connection (`ai`), and current_mode — stored on app_user.settings. Auth +
// user-scoped. `GET /ai/models` proxies the configured provider (connection proof).
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(settings.get));
router.patch('/', asyncHandler(settings.patch));
router.get('/ai/models', asyncHandler(settings.models));

export default router;
