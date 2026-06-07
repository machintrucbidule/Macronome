import type { Request, Response } from 'express';
import {
  CreatePantrySchema,
  ErrorCode,
  PantryListQuerySchema,
  UpdatePantrySchema,
} from '@macronome/shared';
import * as pantryService from '../../services/pantry.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the garde-manger (Paramètres view). The Repas 📌 pin/unpin endpoints
// share the same pantry_item data and live on the entries controller. The service throws
// 409 pantry_duplicate / 422 unknown_food; a false remove → 404.
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function list(req: Request, res: Response): Promise<void> {
  const parsed = PantryListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json({ data: await pantryService.list(userId(res), parsed.data.meal_slot_name) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreatePantrySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json({ data: await pantryService.create(userId(res), parsed.data) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdatePantrySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const item = await pantryService.update(userId(res), req.params.id as string, parsed.data);
  if (!item) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: item });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await pantryService.remove(userId(res), req.params.id as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}
