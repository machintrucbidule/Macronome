import type { Request, Response } from 'express';
import { ErrorCode, LoggableSearchQuerySchema } from '@macronome/shared';
import * as recipesService from '../../services/recipes.js';
import { ApiError, zodDetails } from '../errors.js';

// Combined log search controller (spec/api/foods-recipes.md §"Combined log search").
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function loggable(req: Request, res: Response): Promise<void> {
  const parsed = LoggableSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await recipesService.loggableSearch(userId(res), parsed.data));
}
