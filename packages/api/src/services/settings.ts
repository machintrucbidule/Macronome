import type { DietFlag, PatchSettingsRequest, Settings } from '@macronome/shared';
import type { Prisma } from '@prisma/client';
import { userRepo } from '../data/repositories/user.repo.js';

// Settings service (spec/api §Settings). Reads/writes the app_user.settings JSON blob and
// applies defaults on read. PATCH merges onto the stored blob so unrelated keys are never
// clobbered. `llm_endpoint` is stored but unused in v1 (DECISIONS Gap 14a). `current_mode`
// persists the Weight screen's Régime/Maintien choice (deviation recorded in the M7 plan;
// carried in from M4) and the Weight read-model gates the projection on it server-side.

const DEFAULTS: Settings = {
  locale: 'fr',
  theme: 'dark',
  llm_endpoint: null,
  current_mode: null,
};

/** Coerce the stored JSON blob into the full Settings shape (defaults for missing keys). */
function toDto(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>;
  return {
    locale: s.locale ?? DEFAULTS.locale,
    theme: s.theme ?? DEFAULTS.theme,
    llm_endpoint: s.llm_endpoint ?? DEFAULTS.llm_endpoint,
    current_mode: s.current_mode ?? DEFAULTS.current_mode,
  };
}

export async function get(userId: string): Promise<Settings | null> {
  const user = await userRepo.findById(userId);
  return user ? toDto(user.settings) : null;
}

export async function patch(userId: string, body: PatchSettingsRequest): Promise<Settings | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;
  const merged: Settings = { ...toDto(user.settings) };
  if (body.locale !== undefined) merged.locale = body.locale;
  if (body.theme !== undefined) merged.theme = body.theme;
  if (body.llm_endpoint !== undefined) merged.llm_endpoint = body.llm_endpoint;
  if (body.current_mode !== undefined) merged.current_mode = body.current_mode;
  await userRepo.updateSettings(userId, merged as unknown as Prisma.InputJsonValue);
  return merged;
}

/** The persisted Régime/Maintien mode, or null when unset (Weight read-model gate). */
export async function currentMode(userId: string): Promise<DietFlag | null> {
  const settings = await get(userId);
  return settings?.current_mode ?? null;
}
