import type { Request, Response } from 'express';
import { ErrorCode, PatchSettingsSchema } from '@macronome/shared';
import * as settingsService from '../../services/settings.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse → service → serialise. Settings live on
// app_user.settings and are edited on the Paramètres screen. requireAuth exposes userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /settings — locale, theme, reserved llm_endpoint, current_mode (200). */
export async function get(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.get(userId(res));
  if (!settings) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: settings });
}

/** PATCH /settings — partial merge onto the stored blob (200). */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const settings = await settingsService.patch(userId(res), parsed.data);
  if (!settings) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: settings });
}
