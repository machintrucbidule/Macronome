import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSetupState } from './useSetupState';

// First-run gate (M8). While no owner account exists, force the setup wizard; once it
// does, keep visitors off /setup. This is the setup-only guard — full unauthenticated
// route protection (redirect logged-out users to /login) is deferred to M9.
export function AppGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data, isLoading } = useSetupState();

  // Until the probe resolves, render nothing rather than flashing a screen we may redirect.
  if (isLoading) return null;

  const setupRequired = data?.setup_required ?? false;
  if (setupRequired && pathname !== '/setup') return <Navigate to="/setup" replace />;
  // Once an owner exists the wizard has no purpose: send /setup visitors to the app home
  // (also covers the just-completed wizard flipping the probe while still on /setup).
  if (!setupRequired && pathname === '/setup') return <Navigate to="/" replace />;

  return <>{children}</>;
}
