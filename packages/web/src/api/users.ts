import type { AdminUser, SetAdminRequest } from '@macronome/shared';
import { api } from './client';

// Admin user-management client (spec/api/users-admin.md, B-192). Admin-only:
// the server answers 403 for non-admins; guards (own_account, last_admin) are 409.

export const usersApi = {
  list: () => api.get<{ data: AdminUser[] }>('/users'),
  setRole: (id: string, body: SetAdminRequest) =>
    api.patch<{ data: AdminUser }>(`/users/${id}`, body),
  remove: (id: string) => api.del<void>(`/users/${id}`),
};
