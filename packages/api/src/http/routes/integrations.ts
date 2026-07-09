import { Router } from 'express';
import * as integrations from '../controllers/integrations.js';
import * as gdrive from '../controllers/gdrive.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// /api/v1/integrations — server-side integrations (spec/api/integrations.md). Auth'd;
// configs live on settings.integrations. HA/gateway are proxies; google-drive is an OAuth
// backup handshake + actions (B-208). The callback GET is CSRF-exempt (anti-forgery = state).
const router = Router();
router.use(requireAuth);

router.get('/home-assistant/weight', asyncHandler(integrations.haWeight));
router.get('/barclaude-gateway/ping', asyncHandler(integrations.gatewayPing));
router.get('/barclaude-gateway/search', asyncHandler(integrations.gatewaySearch));
router.get('/barclaude-gateway/products/:id', asyncHandler(integrations.gatewayProduct));

router.post('/google-drive/connect', asyncHandler(gdrive.connect));
router.get('/google-drive/callback', asyncHandler(gdrive.callback));
router.get('/google-drive/status', asyncHandler(gdrive.status));
router.post('/google-drive/disconnect', asyncHandler(gdrive.disconnect));
router.post('/google-drive/backup-now', asyncHandler(gdrive.backupNow));

export default router;
