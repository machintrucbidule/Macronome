import type { Request, Response } from 'express';
import {
  CreateMealEntrySchema,
  ErrorCode,
  ReorderEntriesSchema,
  UpdateMealEntrySchema,
} from '@macronome/shared';
import * as entriesService from '../../services/entries.js';
import * as pantryService from '../../services/pantry.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for meal entries. Ownership (meal/entry → day_log.user_id) is enforced
// in the service/repo; a null result here means not found / not owned → 404.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /meals/:mealId/entries — referenced or custom line. */
export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateMealEntrySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const entry = await entriesService.create(userId(res), req.params.mealId as string, parsed.data);
  if (!entry) throw new ApiError(404, ErrorCode.NotFound);
  res.status(201).json(entry);
}

/** PATCH /meals/:mealId/entries/:id — change qty/unit/food or custom values. */
export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdateMealEntrySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const entry = await entriesService.update(userId(res), req.params.id as string, parsed.data);
  if (!entry) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(entry);
}

/** PATCH /meals/:mealId/entries/order — reorder the meal's lines (drag grip, B-029). */
export async function reorder(req: Request, res: Response): Promise<void> {
  const parsed = ReorderEntriesSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const ok = await entriesService.reorder(userId(res), req.params.mealId as string, parsed.data);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}

/** DELETE /meals/:mealId/entries/:id. */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await entriesService.remove(userId(res), req.params.id as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}

/** POST /meals/:mealId/entries/:id/pin — pin this line's food (future prefill only). */
export async function pin(req: Request, res: Response): Promise<void> {
  const entry = await pantryService.pin(userId(res), req.params.id as string);
  if (!entry) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(entry);
}

/** POST /meals/:mealId/entries/:id/unpin — unpin (future prefill only). */
export async function unpin(req: Request, res: Response): Promise<void> {
  const entry = await pantryService.unpin(userId(res), req.params.id as string);
  if (!entry) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(entry);
}
