import type {
  PasswordChangeRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionUser,
  SetupRequest,
  SetupStateResponse,
  TokenStateResponse,
} from '@macronome/shared';
import { api } from './client';

// Auth resource client (spec/api §Auth). The Compte screen reads the session user
// (username), changes the password via the dedicated flow, and logs out. The login form
// and the first-run wizard open a session via /login and /setup; the token-link flows
// (B-193/B-194) POST the token in the body only (it rides the URL fragment client-side).

export const authApi = {
  session: () => api.get<{ user: SessionUser }>('/auth/session'),
  login: (body: { username: string; password: string; stay_signed_in?: boolean }) =>
    api.post<{ user: SessionUser }>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  changePassword: (body: PasswordChangeRequest) => api.post<void>('/auth/password', body),
  setupState: () => api.get<SetupStateResponse>('/auth/setup-state'),
  setup: (body: SetupRequest) => api.post<{ user: SessionUser }>('/auth/setup', body),
  tokenState: (token: string) => api.post<TokenStateResponse>('/auth/token-state', { token }),
  register: (body: RegisterRequest) => api.post<{ user: SessionUser }>('/auth/register', body),
  resetPassword: (body: ResetPasswordRequest) => api.post<void>('/auth/reset-password', body),
};
