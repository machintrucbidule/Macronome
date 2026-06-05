import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { SESSION_KEY } from '../../app/useSession';

// Login submission (M8). Opens the session via POST /auth/login, refreshes the cached
// session user, and routes home. Any failure surfaces a single generic, non-enumerating
// flag — lockout countdown / detailed states are M9 polish.
export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(username: string, password: string): Promise<void> {
    setFailed(false);
    setPending(true);
    try {
      await authApi.login({ username, password });
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void navigate('/');
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, failed };
}
