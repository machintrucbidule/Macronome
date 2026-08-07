import type { Request, Response } from 'express';
import { ErrorCode, RecipeBulkUpdateSchema, RecipeIdsQuerySchema } from '@macronome/shared';
import * as bulk from '../../services/recipes-bulk.js';
import { ApiError, zodDetails } from '../errors.js';

// Bulk-edit controllers for Recettes (BE-1/B-308) — the twin of `foods-bulk.ts`.

function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /recipes/ids — every id matching the filter, unpaginated. */
export async function ids(req: Request, res: Response): Promise<void> {
  const parsed = RecipeIdsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await bulk.ids(userId(res), parsed.data));
}

/** PATCH /recipes/bulk — 404 when any id is not the user's, and nothing is written. */
export async function update(req: Request, res: Response): Promise<void> {
  const parsed = RecipeBulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await bulk.bulkUpdate(userId(res), parsed.data);
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(result);
}

/** POST /recipes/bulk/undo — single-level; 409 once consumed or with no batch on record. */
export async function undo(_req: Request, res: Response): Promise<void> {
  const result = await bulk.bulkUndo(userId(res));
  if (!result) throw new ApiError(409, ErrorCode.NothingToUndo);
  res.status(200).json(result);
}
