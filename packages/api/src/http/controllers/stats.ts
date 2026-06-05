import type { Request, Response } from 'express';
import { ErrorCode, StatsAdherenceQuerySchema } from '@macronome/shared';
import * as statsService from '../../services/stats.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the read-only stats views (spec/api §Stats): validate → service →
// serialise. requireAuth exposes the session user via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /stats/rolling — 7/14/30/365 windows as of the latest logged day (200). */
export async function rolling(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await statsService.getRolling(userId(res)));
}

/** GET /stats/adherence?year=YYYY — heatmap, monthly pivots, key figures, signals (200). */
export async function adherence(req: Request, res: Response): Promise<void> {
  const parsed = StatsAdherenceQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await statsService.getAdherence(userId(res), parsed.data.year));
}
