import type {
  AccountTokenSummary,
  AdminUser,
  CreatedToken,
  SetAdminRequest,
} from '@macronome/shared';
import { api } from './client';

// Admin user-management client (spec/api/users-admin.md, B-192..194). Admin-only:
// the server answers 403 for non-admins; guards (own_account, last_admin) are 409.
// Token creation returns the raw link secret once — it is never listed again.

export const usersApi = {
  list: () => api.get<{ data: AdminUser[] }>('/users'),
  setRole: (id: string, body: SetAdminRequest) =>
    api.patch<{ data: AdminUser }>(`/users/${id}`, body),
  remove: (id: string) => api.del<void>(`/users/${id}`),
  createInvite: (isAdmin: boolean) =>
    api.post<{ data: CreatedToken }>('/users/invites', { is_admin: isAdmin }),
  listTokens: () => api.get<{ data: AccountTokenSummary[] }>('/users/tokens'),
  revokeToken: (id: string) => api.del<void>(`/users/tokens/${id}`),
  createResetToken: (userId: string) =>
    api.post<{ data: CreatedToken }>(`/users/${userId}/reset-token`),
};
