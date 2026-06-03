import type { Request, Response } from 'express';
import { ErrorCode, PatchProfileSchema } from '@macronome/shared';
import * as profileService from '../../services/profile.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers: Zod-parse → service → serialise. The metabolic profile lives on
// app_user and is edited on the Cibles screen.
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function get(_req: Request, res: Response): Promise<void> {
  const profile = await profileService.get(userId(res));
  if (!profile) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: profile });
}

export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchProfileSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json({ data: await profileService.patch(userId(res), parsed.data) });
}
