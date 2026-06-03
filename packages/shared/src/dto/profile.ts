import { z } from 'zod';

// Metabolic-profile DTOs (spec/api/weight-targets-stats-settings.md §"GET/PATCH
// /profile"). The profile lives on app_user and is edited on the Cibles screen; it
// feeds the engine (sex, height, birthdate → derived age). Age is never written.

export const SexSchema = z.enum(['male', 'female']);
export type Sex = z.infer<typeof SexSchema>;

/** Birthdate as a calendar date (YYYY-MM-DD); the engine derives age against today. */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

export const ProfileSchema = z.object({
  sex: SexSchema,
  birthdate: dateString,
  height_cm: z.number().positive(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PatchProfileSchema = ProfileSchema.partial();
export type PatchProfileRequest = z.infer<typeof PatchProfileSchema>;
