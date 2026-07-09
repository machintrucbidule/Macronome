import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { ApiError, markLoginSuccess } from '../../api/client';
import { PUBLIC_PATHS } from '../../app/public-paths';
import { SESSION_KEY } from '../../app/useSession';

// Login submission + the server-driven state machine (design/components/states.md §Login).
// The API owns the verdicts: 401 invalid_credentials → error, 429 locked_out + retry_after_s
// → lockout (live countdown), success → flash then redirect. On success the user is returned
// to the page they originally requested (?next=, set by RequireAuth / the client's 401
// handler), falling back to / (login.md; B-219). The web only renders these.
export type LoginState = 'idle' | 'loading' | 'error' | 'lockout' | 'success';

const REDIRECT_DELAY_MS = 900;

// A ?next= return target is honoured only when it is a same-origin app path: a single leading
// slash (rejects protocol-relative "//host" and absolute URLs) and not a public/auth page
// (returning to /login etc. would loop). Anything else falls back to the home route.
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  const pathname = next.split(/[?#]/)[0] ?? next;
  if (PUBLIC_PATHS.has(pathname)) return '/';
  return next;
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [state, setState] = useState<LoginState>('idle');
  const [lockSeconds, setLockSeconds] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  }, []);

  // Lockout countdown: decrement once per second; back to idle when it elapses.
  useEffect(() => {
    if (state !== 'lockout') return clearTick();
    tick.current = setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          clearTick();
          setState('idle');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return clearTick;
  }, [state, clearTick]);

  const submit = useCallback(
    async (username: string, password: string, staySignedIn: boolean): Promise<void> => {
      setState('loading');
      try {
        await authApi.login({ username, password, stay_signed_in: staySignedIn });
        markLoginSuccess();
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        setState('success');
        const target = safeNext(new URLSearchParams(location.search).get('next'));
        setTimeout(() => void navigate(target), REDIRECT_DELAY_MS);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          setLockSeconds(err.retryAfterS ?? 0);
          setState('lockout');
        } else {
          setState('error');
        }
      }
    },
    [navigate, queryClient, location.search],
  );

  return { state, lockSeconds, submit };
}
