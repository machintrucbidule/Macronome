import type { PasswordChangeRequest, SessionUser } from '@macronome/shared';
import { api } from './client';

// Auth resource client (spec/api §Auth). The Compte screen reads the session user
// (username), changes the password via the dedicated flow, and logs out.

export const authApi = {
  session: () => api.get<{ user: SessionUser }>('/auth/session'),
  logout: () => api.post<void>('/auth/logout'),
  changePassword: (body: PasswordChangeRequest) => api.post<void>('/auth/password', body),
};
