import { Router } from 'express';
import * as data from '../controllers/data.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Data management resource (spec/api/data-export-import.md — IMP-1): export a full snapshot,
// import (REPLACE) one, or wipe tracked data. Auth + user-scoped; the global CSRF middleware
// guards the two POSTs. The large JSON body limit lives on app.ts's json parser.
const router = Router();

router.use(requireAuth);
router.get('/export', asyncHandler(data.exportData));
router.post('/import', asyncHandler(data.importDataController));
router.post('/wipe', asyncHandler(data.wipeDataController));

export default router;
