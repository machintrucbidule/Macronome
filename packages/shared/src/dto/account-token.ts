import { z } from 'zod';
import { SetupRequestSchema } from './auth.js';

// Token-link DTOs (spec/api/users-admin.md §Token endpoints + 00-conventions §7;
// B-193 invitations / B-194 password resets). The raw token is returned once at
// creation and only ever travels in POST bodies (web-side: the URL fragment).

export const CreateInviteSchema = z.object({ is_admin: z.boolean() });
export type CreateInviteRequest = z.infer<typeof CreateInviteSchema>;

export const TokenStateRequestSchema = z.object({ token: z.string().min(1).max(128) });
export type TokenStateRequest = z.infer<typeof TokenStateRequestSchema>;

export const RegisterRequestSchema = SetupRequestSchema.extend({
  token: z.string().min(1).max(128),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1).max(128),
  new_password: z.string().min(8).max(1024),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export type AccountTokenKind = 'invite' | 'password_reset';

/** Pending-link row (GET /users/tokens) — the token itself is never listed. */
export interface AccountTokenSummary {
  id: string;
  kind: AccountTokenKind;
  is_admin: boolean;
  username: string | null;
  created_at: string;
  expires_at: string;
}

/** Creation response — `token` is the raw secret, shown once. */
export interface CreatedToken {
  id: string;
  token: string;
  expires_at: string;
  is_admin: boolean;
}

export interface TokenStateResponse {
  valid: boolean;
  kind?: AccountTokenKind;
  is_admin?: boolean;
}
