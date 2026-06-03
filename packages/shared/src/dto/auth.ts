import { z } from 'zod';

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
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const LoginResponseSchema = z.object({ user: SessionUserSchema });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const PasswordChangeRequestSchema = z.object({
  current_password: z.string().min(1).max(1024),
  new_password: z.string().min(8).max(1024),
});
export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequestSchema>;
