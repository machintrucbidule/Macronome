import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './useSession';

// Authenticated-route guard (M9b). Probes the session via useSession (401 → isError, not
// retried). While the probe is in flight render nothing rather than flash a screen we may
// redirect away from; if logged out, send to /login. Sits inside AppGate (first-run setup)
// and wraps every app route; /login and /setup stay public.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data, isLoading, isError } = useSession();

  if (isLoading) return null;
  if (isError || !data) return <Navigate to="/login" replace state={{ from: pathname }} />;

  return <>{children}</>;
}
