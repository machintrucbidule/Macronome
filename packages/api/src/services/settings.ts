import type {
  AiConnection,
  DietFlag,
  GoogleDriveConnection,
  Locale,
  PatchSettingsRequest,
  Settings,
  Theme,
} from '@macronome/shared';
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
  min_meal_columns: 4,
};

function storedIntegrations(s: Partial<StoredSettings>): StoredIntegrations {
  return {
    home_assistant: s.integrations?.home_assistant ?? null,
    barclaude_gateway: s.integrations?.barclaude_gateway ?? null,
    google_drive: s.integrations?.google_drive ?? null,
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
    min_meal_columns: s.min_meal_columns ?? STORED_DEFAULTS.min_meal_columns,
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
  if (body.min_meal_columns !== undefined) merged.min_meal_columns = body.min_meal_columns;
  await userRepo.updateSettings(userId, merged);
  return toDto(merged);
}

/**
 * Seed a brand-new account's appearance from the choice made on the pre-auth bar (B-237).
 * Both fields are optional: with neither, nothing is written and the account keeps the stored
 * defaults exactly as before. Returns the effective pair so the caller can put it in the
 * SessionUser without re-deriving the defaults.
 */
export async function seedAppearance(
  userId: string,
  input: { locale?: Locale | undefined; theme?: Theme | undefined },
): Promise<{ locale: Locale; theme: Theme }> {
  const effective = {
    locale: input.locale ?? STORED_DEFAULTS.locale,
    theme: input.theme ?? STORED_DEFAULTS.theme,
  };
  if (input.locale === undefined && input.theme === undefined) return effective;

  const user = await userRepo.findById(userId);
  if (!user) return effective;
  await userRepo.updateSettings(userId, { ...toStored(user.settings), ...effective });
  return effective;
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

/** Raw (secret-bearing) Google Drive connection, or null — used by the backup service only. */
export async function rawGoogleDrive(userId: string): Promise<GoogleDriveConnection | null> {
  const user = await userRepo.findById(userId);
  return user ? toStored(user.settings).integrations.google_drive : null;
}

/**
 * Write the server-managed Google Drive fields (`refresh_token`, `folder_id`, `last_*`) —
 * the OAuth callback, the scheduler and Backup-now use this, never PATCH /settings. Merges
 * `fields` onto the stored connection (creating a minimal one if absent) and persists the
 * whole blob. Returns null when the user is absent.
 */
export async function writeGoogleDrive(
  userId: string,
  fields: Partial<GoogleDriveConnection>,
): Promise<GoogleDriveConnection | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;
  const merged = toStored(user.settings);
  const current: GoogleDriveConnection = merged.integrations.google_drive ?? {
    client_id: '',
    enabled: false,
    retention_days: 7,
    time_of_day: '03:00',
  };
  const next: GoogleDriveConnection = { ...current, ...fields };
  merged.integrations = { ...merged.integrations, google_drive: next };
  await userRepo.updateSettings(userId, merged);
  return next;
}
