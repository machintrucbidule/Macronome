import { z } from 'zod';
import { DietFlagSchema } from './weight.js';

// App-settings DTOs (spec/api/weight-targets-stats-settings.md §Settings). Stored on the
// app_user.settings JSON column and edited on the Paramètres screen: locale, theme, the
// reserved (inert in v1) llm_endpoint, plus current_mode.
//
// DEVIATION (user-approved, recorded in docs/dev-plan/M7-settings-pantry.md): the contract
// DTO is {locale, theme, llm_endpoint?}; `current_mode` is added here so the Weight screen's
// Régime/Maintien choice persists (it had no write endpoint — carried in from M4). It reuses
// the weigh-in DietFlag literals; 'not_in_diet' is the Maintien mode that gates the
// projection server-side.

export const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const ThemeSchema = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof ThemeSchema>;

/** Reserved OpenAI-compatible endpoint (stored, unused in v1 — DECISIONS Gap 14a). */
export const LlmEndpointSchema = z.object({
  url: z.string().url(),
  key: z.string().optional(),
});
export type LlmEndpoint = z.infer<typeof LlmEndpointSchema>;

/** GET /settings response shape (full, with defaults applied by the server). */
export interface Settings {
  locale: Locale;
  theme: Theme;
  llm_endpoint: LlmEndpoint | null;
  current_mode: z.infer<typeof DietFlagSchema> | null;
}

/** PATCH /settings — partial; merged onto the stored settings (other keys preserved). */
export const PatchSettingsSchema = z
  .object({
    locale: LocaleSchema,
    theme: ThemeSchema,
    llm_endpoint: LlmEndpointSchema.nullable(),
    current_mode: DietFlagSchema.nullable(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchSettingsRequest = z.infer<typeof PatchSettingsSchema>;
