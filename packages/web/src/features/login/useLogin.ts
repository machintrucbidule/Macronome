import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { SESSION_KEY } from '../../app/useSession';

// Login submission + the server-driven state machine (design/components/states.md §Login).
// The API owns the verdicts: 401 invalid_credentials → error, 429 locked_out + retry_after_s
// → lockout (live countdown), success → flash then redirect home. The web only renders them.
export type LoginState = 'idle' | 'loading' | 'error' | 'lockout' | 'success';

const REDIRECT_DELAY_MS = 900;

export function useLogin() {
  const navigate = useNavigate();
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
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        setState('success');
        setTimeout(() => void navigate('/'), REDIRECT_DELAY_MS);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          setLockSeconds(err.retryAfterS ?? 0);
          setState('lockout');
        } else {
          setState('error');
        }
      }
    },
    [navigate, queryClient],
  );

  return { state, lockSeconds, submit };
}
