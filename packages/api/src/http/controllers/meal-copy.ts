import type { Request, Response } from 'express';
import { CopyDaySchema, ErrorCode } from '@macronome/shared';
import { copyMealFrom } from '../../services/meal-copy.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controller for the per-meal copy (CP-2 / B-248). The body is the day-level copy's
// `{from}` — same shape, so the same schema. Ownership, the summary-day refusal and the
// "nothing to copy" cases live in the service; here only the body's shape is checked.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /meals/:mealId/copy-from — replace this meal with the matching meal of `from`. */
export async function copyFrom(req: Request, res: Response): Promise<void> {
  const parsed = CopyDaySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const mealId = req.params.mealId as string;
  res.status(200).json(await copyMealFrom(userId(res), mealId, parsed.data.from));
}
