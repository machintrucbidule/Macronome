import type { Request, Response } from 'express';
import { ClearMealSchema, ErrorCode } from '@macronome/shared';
import { clearMeal } from '../../services/meal-clear.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controller for the per-meal clear (MC-1 / B-296). Ownership, the summary-day refusal and
// the partition all live in the service; here only the body's shape is checked.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /meals/:mealId/clear — empty this meal (`delete`) or zero its quantities (`zero`). */
export async function clear(req: Request, res: Response): Promise<void> {
  const parsed = ClearMealSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const mealId = req.params.mealId as string;
  res.status(200).json(await clearMeal(userId(res), mealId, parsed.data.mode));
}
