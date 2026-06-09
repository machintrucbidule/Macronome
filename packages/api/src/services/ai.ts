import { ErrorCode, type DishPhotoMacros, type DishPhotoMacrosRequest } from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import { buildDishPhotoMessages, parseDishPhotoResult } from '../domain/ai-dish-photo/index.js';
import * as aiProvider from './ai-provider.js';
import { get as getSettings, rawAiConfig } from './settings.js';

// AI *use* orchestration (spec/api/ai.md, spec/logic/ai-dish-photo-macros.md, B-118). Reads the
// stored (secret-bearing) ai config, assembles the multimodal prompt, calls the vision model and
// parses the response. Persists nothing — returns an estimate the client maps into the form.

export async function dishPhotoMacros(
  userId: string,
  body: DishPhotoMacrosRequest,
): Promise<DishPhotoMacros> {
  const ai = await rawAiConfig(userId);
  const model = ai?.tasks.dish_photo_macros.model ?? null;
  // The link may be set but this task not (null model) → treat as not configured (§6 error table).
  if (model === null) throw new ApiError(409, ErrorCode.AiNotConfigured);

  // dish_name is returned in the user's UI language (B-119).
  const locale = (await getSettings(userId))?.locale ?? 'fr';
  const messages = buildDishPhotoMessages(
    ai!.tasks.dish_photo_macros.prompt,
    body.note,
    body.images,
    locale,
  );
  const text = await aiProvider.chatCompletion(ai, model, messages);

  const parsed = parseDishPhotoResult(text);
  if (!parsed.ok) throw new ApiError(502, ErrorCode.AiBadResponse);
  return parsed.data;
}
