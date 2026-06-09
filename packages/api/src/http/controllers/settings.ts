import type { Request, Response } from 'express';
import { ErrorCode, PatchSettingsSchema } from '@macronome/shared';
import * as settingsService from '../../services/settings.js';
import * as aiProvider from '../../services/ai-provider.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse → service → serialise. Settings live on
// app_user.settings and are edited on the Paramètres screen. requireAuth exposes userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /settings — locale, theme, the AI connection (redacted), current_mode (200). */
export async function get(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.get(userId(res));
  if (!settings) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: settings });
}

/**
 * GET /settings/ai/models — proxy the configured provider's model list (the connection proof).
 * Reads the stored (secret-bearing) AI config; the api_key is never returned/logged.
 */
export async function models(_req: Request, res: Response): Promise<void> {
  const ai = await settingsService.rawAiConfig(userId(res));
  const list = await aiProvider.listModels(ai);
  res.status(200).json(list);
}

/** PATCH /settings — partial merge onto the stored blob (200). */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const settings = await settingsService.patch(userId(res), parsed.data);
  if (!settings) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: settings });
}
