import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth';

// The authenticated session user (username + persisted locale/theme). Shared by the
// account menu (avatar initials) and the Compte screen. 401 (logged out) is not retried.
export const SESSION_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => authApi.session(),
    retry: false,
    staleTime: 60_000,
  });
}

/** Up-to-two-letter avatar initials from a username (e.g. "ivan" → "IV"). */
export function initials(username: string | undefined): string {
  if (!username) return '··';
  return username.slice(0, 2).toUpperCase();
}
