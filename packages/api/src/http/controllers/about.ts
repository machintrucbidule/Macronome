import type { Request, Response } from 'express';
import * as aboutService from '../../services/about.js';

// THIN controller (api-CLAUDE.md): service → serialise. The about snapshot is global (host +
// app), not user-scoped, but the route is behind requireAuth so only the owner sees it.

/** GET /about — app + server/runtime snapshot (200). */
export async function get(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await aboutService.getAbout() });
}
