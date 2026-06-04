import type { Request, Response } from 'express';
import {
  CreateWeighInSchema,
  ErrorCode,
  PatchWeighInSchema,
  WeightRangeQuerySchema,
} from '@macronome/shared';
import * as weightService from '../../services/weight.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): validate query/body → call the service → serialise.
// requireAuth exposes the session user via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /weight?range=3m|6m|1y|all — full Weight view (200). */
export async function get(req: Request, res: Response): Promise<void> {
  const parsed = WeightRangeQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await weightService.get(userId(res), parsed.data.range));
}

/** POST /weight — add a weigh-in (201; 409 weigh_in_date_occupied on an occupied date). */
export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateWeighInSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json(await weightService.create(userId(res), parsed.data));
}

/** PATCH /weight/:id — edit (incl. date); re-derives adjacent periods (200, 404, 409). */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchWeighInSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const view = await weightService.patch(userId(res), req.params.id as string, parsed.data);
  if (!view) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(view);
}

/** DELETE /weight/:id — re-derives adjacent periods (204, 404). */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await weightService.remove(userId(res), req.params.id as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).send();
}
