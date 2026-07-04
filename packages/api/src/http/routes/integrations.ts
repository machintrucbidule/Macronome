import { Router } from 'express';
import * as integrations from '../controllers/integrations.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// /api/v1/integrations — server-side proxies for the external integrations
// (spec/api/integrations.md). Auth'd; configs live on settings.integrations.
const router = Router();
router.use(requireAuth);

router.get('/home-assistant/weight', asyncHandler(integrations.haWeight));
router.get('/barclaude-gateway/ping', asyncHandler(integrations.gatewayPing));
router.get('/barclaude-gateway/search', asyncHandler(integrations.gatewaySearch));
router.get('/barclaude-gateway/products/:id', asyncHandler(integrations.gatewayProduct));

export default router;
