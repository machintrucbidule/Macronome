import type { AiConnection, DietFlag, PatchSettingsRequest, Settings } from '@macronome/shared';
import { userRepo } from '../data/repositories/user.repo.js';
import { mergeAi, redact } from '../domain/ai-connection/index.js';
import {
  INTEGRATIONS_DEFAULTS,
  mergeIntegrations,
  redactIntegrations,
  type StoredIntegrations,
} from '../domain/integrations/index.js';

// Settings service (spec/api §Settings). Reads/writes the app_user.settings JSON blob and
// applies defaults on read. PATCH merges onto the stored blob so unrelated keys are never
// clobbered. `ai` is the AI-assistant connection: stored with its secret, deep-merged on
// PATCH and **redacted** on read (the api_key is never returned). `current_mode` persists the
// Weight screen's Régime/Maintien choice (deviation recorded in the M7 plan; carried in from
// M4) and the Weight read-model gates the projection on it server-side.

/** The persisted blob — like Settings but the connections carry their raw secrets. */
type StoredSettings = Omit<Settings, 'ai' | 'integrations'> & {
  ai: AiConnection | null;
  integrations: StoredIntegrations;
};

const STORED_DEFAULTS: StoredSettings = {
  locale: 'fr',
  theme: 'dark',
  ai: null,
  integrations: INTEGRATIONS_DEFAULTS,
  current_mode: null,
  open_period_note: null,
  lines_desktop: 20,
  lines_mobile: 15,
};

function storedIntegrations(s: Partial<StoredSettings>): StoredIntegrations {
  return {
    home_assistant: s.integrations?.home_assistant ?? null,
    barclaude_gateway: s.integrations?.barclaude_gateway ?? null,
  };
}

/** Coerce the stored JSON blob into the full StoredSettings shape (defaults for missing keys). */
function toStored(stored: unknown): StoredSettings {
  const s = (stored ?? {}) as Partial<StoredSettings>;
  return {
    locale: s.locale ?? STORED_DEFAULTS.locale,
    theme: s.theme ?? STORED_DEFAULTS.theme,
    ai: s.ai ?? STORED_DEFAULTS.ai,
    integrations: storedIntegrations(s),
    current_mode: s.current_mode ?? STORED_DEFAULTS.current_mode,
    open_period_note: s.open_period_note ?? STORED_DEFAULTS.open_period_note,
    lines_desktop: s.lines_desktop ?? STORED_DEFAULTS.lines_desktop,
    lines_mobile: s.lines_mobile ?? STORED_DEFAULTS.lines_mobile,
  };
}

/** Redacted read DTO (ai api_key → api_key_set; integration secrets → *_set). */
function toDto(stored: StoredSettings): Settings {
  return {
    ...stored,
    ai: redact(stored.ai),
    integrations: redactIntegrations(stored.integrations),
  };
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
  if (body.integrations !== undefined) {
    merged.integrations = mergeIntegrations(merged.integrations, body.integrations);
  }
  if (body.current_mode !== undefined) merged.current_mode = body.current_mode;
  if (body.open_period_note !== undefined) merged.open_period_note = body.open_period_note;
  if (body.lines_desktop !== undefined) merged.lines_desktop = body.lines_desktop;
  if (body.lines_mobile !== undefined) merged.lines_mobile = body.lines_mobile;
  await userRepo.updateSettings(userId, merged);
  return toDto(merged);
}

/** The persisted Régime/Maintien mode, or null when unset (Weight read-model gate). */
export async function currentMode(userId: string): Promise<DietFlag | null> {
  const settings = await get(userId);
  return settings?.current_mode ?? null;
}

/** Weight read-model state stored on settings: the persisted mode + the open-period note. */
export async function weightState(
  userId: string,
): Promise<{ currentMode: DietFlag | null; openPeriodNote: string | null }> {
  const settings = await get(userId);
  return {
    currentMode: settings?.current_mode ?? null,
    openPeriodNote: settings?.open_period_note ?? null,
  };
}

/** The raw (secret-bearing) AI config, or null — used by the models proxy. Never serialised. */
export async function rawAiConfig(userId: string): Promise<AiConnection | null> {
  const user = await userRepo.findById(userId);
  return user ? toStored(user.settings).ai : null;
}

/** Raw (secret-bearing) integrations config — used by the proxies only. Never serialised. */
export async function rawIntegrations(userId: string): Promise<StoredIntegrations> {
  const user = await userRepo.findById(userId);
  return user ? toStored(user.settings).integrations : INTEGRATIONS_DEFAULTS;
}
