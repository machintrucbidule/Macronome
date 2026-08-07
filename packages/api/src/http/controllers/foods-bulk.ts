import type { Request, Response } from 'express';
import { ErrorCode, FoodBulkUpdateSchema, FoodIdsQuerySchema } from '@macronome/shared';
import * as bulk from '../../services/foods-bulk.js';
import { ApiError, zodDetails } from '../errors.js';

// Bulk-edit controllers for Aliments (BE-1). Same thin shape as `foods.ts`; kept in their own file
// because they answer to their own rules (spec/api/00-conventions.md §Bulk writes).

function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /foods/ids — every id matching the filter, unpaginated. */
export async function ids(req: Request, res: Response): Promise<void> {
  const parsed = FoodIdsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await bulk.ids(userId(res), parsed.data));
}

/** PATCH /foods/bulk — 404 when any id is not the user's, and nothing is written. */
export async function update(req: Request, res: Response): Promise<void> {
  const parsed = FoodBulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await bulk.bulkUpdate(userId(res), parsed.data);
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(result);
}

/** POST /foods/bulk/undo — single-level; 409 once consumed or with no batch on record. */
export async function undo(_req: Request, res: Response): Promise<void> {
  const result = await bulk.bulkUndo(userId(res));
  if (!result) throw new ApiError(409, ErrorCode.NothingToUndo);
  res.status(200).json(result);
}
