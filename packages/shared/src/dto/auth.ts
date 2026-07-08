import { z } from 'zod';
import { SexSchema } from './profile.js';

// Auth DTOs (spec/api/00-conventions.md §7). One source for controller validation
// and the web client's request/response types.

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
  stay_signed_in: z.boolean().optional().default(false),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  locale: z.enum(['fr', 'en']),
  theme: z.enum(['system', 'light', 'dark']),
  is_admin: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const LoginResponseSchema = z.object({ user: SessionUserSchema });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const PasswordChangeRequestSchema = z.object({
  current_password: z.string().min(1).max(1024),
  new_password: z.string().min(8).max(1024),
});
export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequestSchema>;

// First-run setup (spec/api/00-conventions.md §7). Allowed only while no user exists;
// creates the single owner (credentials + the profile the metabolic engine needs) and
// opens the session. The probe is non-enumerating — it returns only a boolean.
export const SetupStateResponseSchema = z.object({ setup_required: z.boolean() });
export type SetupStateResponse = z.infer<typeof SetupStateResponseSchema>;

export const SetupRequestSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(8).max(1024),
  sex: SexSchema,
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date'),
  height_cm: z.number().positive(),
});
export type SetupRequest = z.infer<typeof SetupRequestSchema>;
