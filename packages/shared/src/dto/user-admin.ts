import { z } from 'zod';

// Admin user-management DTOs (spec/api/users-admin.md, B-192). Account metadata
// only — never the password hash, settings blob, or metabolic profile.

export const SetAdminSchema = z.object({ is_admin: z.boolean() });
export type SetAdminRequest = z.infer<typeof SetAdminSchema>;

export interface AdminUser {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  last_seen_at: string | null;
}
