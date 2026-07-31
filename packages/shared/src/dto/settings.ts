import { z } from 'zod';
import { DietFlagSchema } from './weight.js';
import { IntegrationsPatchSchema, type IntegrationsRead } from './integrations.js';

// App-settings DTOs (spec/api/weight-targets-stats-settings.md §Settings). Stored on the
// app_user.settings JSON column and edited on the Paramètres screen: locale, theme, the
// AI-assistant connection (`ai`), plus current_mode.
//
// DEVIATION (user-approved, recorded in docs/dev-plan/M7-settings-pantry.md): the contract
// DTO is {locale, theme, ai?}; `current_mode` is added here so the Weight screen's
// Régime/Maintien choice persists (it had no write endpoint — carried in from M4). It reuses
// the weigh-in DietFlag literals; 'not_in_diet' is the Maintien mode that gates the
// projection server-side.

export const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const ThemeSchema = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof ThemeSchema>;

// --- AI assistant connection (spec/logic/ai-connection.md, DECISIONS Gap 14 / B-117) ---

/** Provider kind; only value in v1, extensible later. */
export const AiProviderSchema = z.enum(['openai_compatible']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

/**
 * Full (stored) task shape — `model` is null or a non-empty id, `prompt` is non-empty
 * (blank is normalised to the default before storing, never persisted blank — §2/§3).
 */
const AiTaskSchema = z.object({
  model: z.string().min(1).nullable(),
  prompt: z.string().min(1),
});

/**
 * Full (stored) connection config — used to validate a complete config (oracles §8.1/§8.2)
 * and as the redact/merge input type. `api_key`, when present, is non-empty after trim (§2).
 */
export const AiConnectionSchema = z.object({
  provider: AiProviderSchema,
  base_url: z.string().url({ message: 'invalid_url' }),
  api_key: z
    .string()
    .refine((v) => v.trim().length > 0, { message: 'empty' })
    .optional(),
  tasks: z.object({
    dish_photo_macros: AiTaskSchema,
    meal_suggestions: AiTaskSchema,
    advice: AiTaskSchema,
  }),
  /** Free-text allergies / disliked foods (B-216). Connection-level (not per task): sent to BOTH
   *  the advice and meal-suggestions models so neither proposes these foods. Optional; not a
   *  secret (returned unredacted). */
  avoidances: z.string().max(1000).optional(),
});
export type AiConnection = z.infer<typeof AiConnectionSchema>;

/** Redacted read shape — `api_key` is never returned; `api_key_set` exposes its presence. */
const AiTaskReadSchema = z.object({ model: z.string().nullable(), prompt: z.string() });
export const AiConnectionReadSchema = z.object({
  provider: AiProviderSchema,
  base_url: z.string(),
  api_key_set: z.boolean(),
  tasks: z.object({
    dish_photo_macros: AiTaskReadSchema,
    meal_suggestions: AiTaskReadSchema,
    advice: AiTaskReadSchema,
  }),
  /** Allergies / disliked foods (B-216); returned as-is (not a secret), defaulting to `''`. */
  avoidances: z.string(),
});
export type AiConnectionRead = z.infer<typeof AiConnectionReadSchema>;

/**
 * Partial (deep) PATCH shape — every field optional so the masked UI can update everything
 * but the secret. `api_key` absent = keep, `''`/`null` = clear, else replace (merge §4).
 * `base_url`, when present, must be a valid URL (§2). Blank prompts are normalised on merge.
 */
const AiTaskPatchSchema = z.object({ model: z.string().nullable(), prompt: z.string() }).partial();
export const AiConnectionPatchSchema = z.object({
  provider: AiProviderSchema.optional(),
  base_url: z.string().url({ message: 'invalid_url' }).optional(),
  api_key: z.string().nullable().optional(),
  tasks: z
    .object({
      dish_photo_macros: AiTaskPatchSchema,
      meal_suggestions: AiTaskPatchSchema,
      advice: AiTaskPatchSchema,
    })
    .partial()
    .optional(),
  /** Allergies / disliked foods (B-216); absent = keep, `''` = clear, else replace. */
  avoidances: z.string().max(1000).optional(),
});
export type AiConnectionPatch = z.infer<typeof AiConnectionPatchSchema>;

/** GET /settings response shape (full, with defaults applied by the server). */
export interface Settings {
  locale: Locale;
  theme: Theme;
  ai: AiConnectionRead | null;
  /** External integrations (B-180/B-181); both keys present, redacted (dto/integrations). */
  integrations: IntegrationsRead;
  current_mode: z.infer<typeof DietFlagSchema> | null;
  /** Weight open-interval note (B-176); persisted on app_user.settings, cleared on close. */
  open_period_note: string | null;
  /** Displayed-line floor per meal column (B-203, supersedes the fixed B-186 18/15); the min
   * rows a meal shows on each layout — user-configurable, defaults desktop 20 / mobile 15. */
  lines_desktop: number;
  lines_mobile: number;
  /** Minimum meal columns the Repas scroller lays out (B-244), 1..6, default 4 — honoured only
   * while a 300px per-column floor allows it; inert on the ≤760px stacked layout. */
  min_meal_columns: number;
}

/** PATCH /settings — partial; merged onto the stored settings (other keys preserved). */
export const PatchSettingsSchema = z
  .object({
    locale: LocaleSchema,
    theme: ThemeSchema,
    ai: AiConnectionPatchSchema.nullable(),
    integrations: IntegrationsPatchSchema,
    current_mode: DietFlagSchema.nullable(),
    open_period_note: z.string().max(2000).nullable(),
    lines_desktop: z.number().int().min(5).max(50),
    lines_mobile: z.number().int().min(5).max(50),
    min_meal_columns: z.number().int().min(1).max(6),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchSettingsRequest = z.infer<typeof PatchSettingsSchema>;
