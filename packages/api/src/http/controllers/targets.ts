import type { Request, Response } from 'express';
import {
  CreateTargetSchema,
  ErrorCode,
  SuggestTargetSchema,
  TargetWarning,
} from '@macronome/shared';
import * as targetsService from '../../services/targets.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse → call the service → serialise.
// requireAuth guarantees a session user, exposed via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /target — current target + live engine readout (200; warnings, never errors). */
export async function get(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await targetsService.get(userId(res)));
}

/** POST /target — save a target row (201). Carb ceiling ≤ 0 never blocks the save. */
export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateTargetSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json(await targetsService.create(userId(res), parsed.data));
}

/** POST /target/suggest — propose a range from a desired deficit (200; never writes). */
export async function suggest(req: Request, res: Response): Promise<void> {
  const parsed = SuggestTargetSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const range = await targetsService.suggest(userId(res), parsed.data.desired_deficit);
  if (!range) throw new ApiError(409, TargetWarning.NoWeight);
  res.status(200).json(range);
}
