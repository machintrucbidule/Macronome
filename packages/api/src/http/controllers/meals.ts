import type { Request, Response } from 'express';
import { CreateMealSchema, ErrorCode, PatchMealSchema } from '@macronome/shared';
import * as mealsService from '../../services/meals.js';
import { ApiError, zodDetails } from '../errors.js';
import { pathDate } from './days.js';

// THIN controllers for the meals sub-resource (this day's own slots; never the template).
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /days/:date/meals — add a meal (materializing the day). */
export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateMealSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json(await mealsService.create(userId(res), pathDate(req), parsed.data));
}

/** PATCH /days/:date/meals/:mealId — rename / reorder. */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchMealSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const meal = await mealsService.patch(userId(res), req.params.mealId as string, parsed.data);
  if (!meal) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(meal);
}

/** DELETE /days/:date/meals/:mealId. */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await mealsService.remove(userId(res), pathDate(req), req.params.mealId as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}
