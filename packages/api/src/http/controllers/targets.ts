import type { Request, Response } from 'express';
import {
  CreateTargetSchema,
  ErrorCode,
  PatchTargetSchema,
  RecomputeTargetSchema,
  SuggestTargetSchema,
  TargetPreviewSchema,
  TargetWarning,
} from '@macronome/shared';
import * as historyService from '../../services/target-history.js';
import * as recomputeService from '../../services/target-recompute.js';
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

/** POST /target/preview — engine readout for a draft target (200; persists nothing). */
export async function preview(req: Request, res: Response): Promise<void> {
  const parsed = TargetPreviewSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await targetsService.preview(userId(res), parsed.data));
}

/** POST /target/suggest — propose a range from a desired deficit (200; never writes). */
export async function suggest(req: Request, res: Response): Promise<void> {
  const parsed = SuggestTargetSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const range = await targetsService.suggest(userId(res), parsed.data.desired_deficit);
  if (!range) throw new ApiError(409, TargetWarning.NoWeight);
  res.status(200).json(range);
}

// --- Target history (TH-1 / B-091): GET /targets + per-version edit/delete/recompute ---

/** GET /targets — all target versions, newest first, each with its period end (200). */
export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await historyService.list(userId(res)));
}

/** PATCH /targets/:id — edit a version, incl. effective_from (200, 404, 409, 422). */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchTargetSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const version = await historyService.patch(userId(res), req.params.id as string, parsed.data);
  if (!version) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(version);
}

/** DELETE /targets/:id — remove a version (204, 404). */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await historyService.remove(userId(res), req.params.id as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).send();
}

/** POST /targets/:id/recompute — opt-in, auto-only re-freeze of the window (200, 404). */
export async function recompute(req: Request, res: Response): Promise<void> {
  const parsed = RecomputeTargetSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const recomputed = await recomputeService.recompute(
    userId(res),
    req.params.id as string,
    parsed.data,
  );
  if (recomputed === null) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ recomputed });
}

/** GET /targets/:id/recompute-count — days the recompute would touch (200, 404). */
export async function recomputeCount(req: Request, res: Response): Promise<void> {
  const count = await recomputeService.recomputeCount(userId(res), req.params.id as string);
  if (count === null) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ count });
}
