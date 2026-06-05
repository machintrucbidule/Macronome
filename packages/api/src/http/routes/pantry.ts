import { Router } from 'express';
import * as pantry from '../controllers/pantry.js';
import { asyncHandler } from '../async-handler.js';
import { requireAuth } from '../middleware/auth.js';

// Garde-manger resource (spec/api §Settings). The Paramètres view of pantry_item; the Repas
// 📌 pin/unpin (same data) live on /meals/:id/entries/:id/(un)pin. Auth + user-scoped.
const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(pantry.list));
router.post('/', asyncHandler(pantry.create));
router.delete('/:id', asyncHandler(pantry.remove));

export default router;
