import type { Request, Response } from 'express';
import { ErrorCode, JournalQuerySchema } from '@macronome/shared';
import * as journalService from '../../services/journal.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controller for the Journal read view (one row per logged day of a year).
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /journal?year=YYYY — newest day first. */
export async function list(req: Request, res: Response): Promise<void> {
  const parsed = JournalQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await journalService.listByYear(userId(res), parsed.data.year));
}
