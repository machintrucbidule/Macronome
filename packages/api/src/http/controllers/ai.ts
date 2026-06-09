import type { Request, Response } from 'express';
import {
  DishPhotoMacrosRequestSchema,
  ErrorCode,
  MealSuggestionsRequestSchema,
} from '@macronome/shared';
import * as aiService from '../../services/ai.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controller (api-CLAUDE.md): Zod-parse → service → serialise. AI *uses* read the stored
// ai config; requireAuth exposes userId. The call persists nothing.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /ai/dish-photo-macros — estimate a dish's totals from photos (B-118). */
export async function dishPhotoMacros(req: Request, res: Response): Promise<void> {
  const parsed = DishPhotoMacrosRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const data = await aiService.dishPhotoMacros(userId(res), parsed.data);
  res.status(200).json({ data });
}

/** POST /ai/meal-suggestions — propose foods+quantities to bring the day into its targets (B-123).
 *  The LLM picks foods; the solver sets quantities; the totals/fit are certified server-side. */
export async function mealSuggestions(req: Request, res: Response): Promise<void> {
  const parsed = MealSuggestionsRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const data = await aiService.mealSuggestions(userId(res), parsed.data);
  res.status(200).json({ data });
}
