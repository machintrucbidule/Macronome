import type { Request, Response } from 'express';
import { CreateMealTemplateSchema, ErrorCode, PatchMealTemplateSchema } from '@macronome/shared';
import * as templateService from '../../services/meal-template.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the meal-template (default day structure). A null/false service
// result means not found / not owned → 404.
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await templateService.list(userId(res)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateMealTemplateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json({ data: await templateService.create(userId(res), parsed.data) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = PatchMealTemplateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const item = await templateService.update(userId(res), req.params.id as string, parsed.data);
  if (!item) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: item });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await templateService.remove(userId(res), req.params.id as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}
