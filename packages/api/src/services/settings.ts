import type { AiConnection, DietFlag, PatchSettingsRequest, Settings } from '@macronome/shared';
import { userRepo } from '../data/repositories/user.repo.js';
import { mergeAi, redact } from '../domain/ai-connection/index.js';

// Settings service (spec/api §Settings). Reads/writes the app_user.settings JSON blob and
// applies defaults on read. PATCH merges onto the stored blob so unrelated keys are never
// clobbered. `ai` is the AI-assistant connection: stored with its secret, deep-merged on
// PATCH and **redacted** on read (the api_key is never returned). `current_mode` persists the
// Weight screen's Régime/Maintien choice (deviation recorded in the M7 plan; carried in from
// M4) and the Weight read-model gates the projection on it server-side.

/** The persisted blob — like Settings but `ai` carries the raw (secret-bearing) config. */
type StoredSettings = Omit<Settings, 'ai'> & { ai: AiConnection | null };

const STORED_DEFAULTS: StoredSettings = {
  locale: 'fr',
  theme: 'dark',
  ai: null,
  current_mode: null,
};

/** Coerce the stored JSON blob into the full StoredSettings shape (defaults for missing keys). */
function toStored(stored: unknown): StoredSettings {
  const s = (stored ?? {}) as Partial<StoredSettings>;
  return {
    locale: s.locale ?? STORED_DEFAULTS.locale,
    theme: s.theme ?? STORED_DEFAULTS.theme,
    ai: s.ai ?? STORED_DEFAULTS.ai,
    current_mode: s.current_mode ?? STORED_DEFAULTS.current_mode,
  };
}

/** Redacted read DTO (api_key stripped → api_key_set). */
function toDto(stored: StoredSettings): Settings {
  return { ...stored, ai: redact(stored.ai) };
}

export async function get(userId: string): Promise<Settings | null> {
  const user = await userRepo.findById(userId);
  return user ? toDto(toStored(user.settings)) : null;
}

export async function patch(userId: string, body: PatchSettingsRequest): Promise<Settings | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;
  const merged: StoredSettings = { ...toStored(user.settings) };
  if (body.locale !== undefined) merged.locale = body.locale;
  if (body.theme !== undefined) merged.theme = body.theme;
  if (body.ai !== undefined) merged.ai = body.ai === null ? null : mergeAi(merged.ai, body.ai);
  if (body.current_mode !== undefined) merged.current_mode = body.current_mode;
  await userRepo.updateSettings(userId, merged);
  return toDto(merged);
}

/** The persisted Régime/Maintien mode, or null when unset (Weight read-model gate). */
export async function currentMode(userId: string): Promise<DietFlag | null> {
  const settings = await get(userId);
  return settings?.current_mode ?? null;
}

/** The raw (secret-bearing) AI config, or null — used by the models proxy. Never serialised. */
export async function rawAiConfig(userId: string): Promise<AiConnection | null> {
  const user = await userRepo.findById(userId);
  return user ? toStored(user.settings).ai : null;
}
