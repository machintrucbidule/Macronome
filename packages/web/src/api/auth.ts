import type {
  PasswordChangeRequest,
  SessionUser,
  SetupRequest,
  SetupStateResponse,
} from '@macronome/shared';
import { api } from './client';

// Auth resource client (spec/api §Auth). The Compte screen reads the session user
// (username), changes the password via the dedicated flow, and logs out. The login form
// and the first-run wizard open a session via /login and /setup.

export const authApi = {
  session: () => api.get<{ user: SessionUser }>('/auth/session'),
  login: (body: { username: string; password: string }) =>
    api.post<{ user: SessionUser }>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  changePassword: (body: PasswordChangeRequest) => api.post<void>('/auth/password', body),
  setupState: () => api.get<SetupStateResponse>('/auth/setup-state'),
  setup: (body: SetupRequest) => api.post<{ user: SessionUser }>('/auth/setup', body),
};
