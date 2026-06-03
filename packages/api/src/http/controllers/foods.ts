import type { Request, Response } from 'express';
import {
  CreateFoodSchema,
  ErrorCode,
  FoodListQuerySchema,
  UpdateFoodSchema,
} from '@macronome/shared';
import * as foodsService from '../../services/foods.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse the request → call the service →
// serialise. requireAuth guarantees a session user, exposed via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

function pathId(req: Request): string {
  return req.params.id as string;
}

export async function list(req: Request, res: Response): Promise<void> {
  const parsed = FoodListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await foodsService.list(userId(res), parsed.data));
}

export async function get(req: Request, res: Response): Promise<void> {
  const food = await foodsService.get(userId(res), pathId(req));
  if (!food) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: food });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateFoodSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const { food, warnings } = await foodsService.create(userId(res), parsed.data);
  res.status(201).json({ data: food, ...(warnings.length ? { warnings } : {}) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdateFoodSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await foodsService.update(userId(res), pathId(req), parsed.data);
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res
    .status(200)
    .json({ data: result.food, ...(result.warnings.length ? { warnings: result.warnings } : {}) });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const ok = await foodsService.archive(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}

export async function restore(req: Request, res: Response): Promise<void> {
  const ok = await foodsService.restore(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}
