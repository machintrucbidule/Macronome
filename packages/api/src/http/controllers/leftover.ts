import type { Request, Response } from 'express';
import { ErrorCode, LeftoverRequestSchema, PatchLeftoverSchema } from '@macronome/shared';
import * as leftoverService from '../../services/leftover.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the leftover (plate-deduction) resource. The service blocks
// incoherent input with a 409 (gross_below_tare / leftover_exceeds_served), writing
// nothing; a null result is a not-found meal/group → 404.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** POST /meals/:mealId/leftover — freeze container, validate, prorate, persist (201). */
export async function create(req: Request, res: Response): Promise<void> {
  const parsed = LeftoverRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const group = await leftoverService.create(userId(res), req.params.mealId as string, parsed.data);
  if (!group) throw new ApiError(404, ErrorCode.NotFound);
  res.status(201).json(group);
}

/** PATCH /leftover/:groupId — re-edit gross/container/selection (200). */
export async function update(req: Request, res: Response): Promise<void> {
  const parsed = PatchLeftoverSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const group = await leftoverService.update(
    userId(res),
    req.params.groupId as string,
    parsed.data,
  );
  if (!group) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(group);
}

/** DELETE /leftover/:groupId — entries revert to fully consumed (204). */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await leftoverService.remove(userId(res), req.params.groupId as string);
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(204).end();
}
