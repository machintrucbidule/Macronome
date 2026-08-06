import type { Request, Response } from 'express';
import { ErrorCode, FoodRefGroupsQuerySchema, FoodRefListQuerySchema } from '@macronome/shared';
import * as foodRefsService from '../../services/food-refs.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md) for the read-only Ciqual catalog. requireAuth guarantees a
// session user; it is needed even though the catalog is global, because `already_owned` is a
// user-scoped fact (spec/api/foods-recipes.md §Food reference catalog).
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function list(req: Request, res: Response): Promise<void> {
  const parsed = FoodRefListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await foodRefsService.list(userId(res), parsed.data));
}

export async function groups(req: Request, res: Response): Promise<void> {
  const parsed = FoodRefGroupsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json({ data: await foodRefsService.groups(parsed.data.locale) });
}
