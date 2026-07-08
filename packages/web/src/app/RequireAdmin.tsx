import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from './useSession';

// Admin-route guard (B-192). Sits inside RequireAuth (the session is already
// resolved); a non-admin navigating directly to an admin route is silently
// redirected home (owner decision). Presentation only — the API role guard
// (403) is the real protection.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSession();

  if (isLoading) return null;
  if (!data?.user.is_admin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
