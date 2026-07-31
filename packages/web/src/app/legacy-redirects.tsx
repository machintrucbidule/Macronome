import { Navigate, useLocation } from 'react-router-dom';

// Retired French routes → their English replacements (B-240/B-241). Kept as data so the router
// declares them in one loop and the test can walk the same table. They are declared as PUBLIC
// routes: the path is rewritten first, then the target route's RequireAuth applies as usual (so
// a logged-out visitor's ?next= already carries the new path).
//
// Why they must exist rather than just retiring the old paths: the installed PWA's "Paramètres"
// shortcut is frozen at /parametres inside existing installs until they refresh, and any
// bookmark or in-flight Google Drive OAuth return would otherwise land on the not-found page.
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/cibles', '/targets'],
  ['/parametres', '/settings'],
  ['/assistant-ia', '/ai-assistant'],
];

/**
 * Redirect to `to`, **carrying the query string over** — `<Navigate to="/settings">` alone drops
 * it, which would swallow the Google Drive callback marker (`/parametres?gdrive=connected`) sent
 * by an older client. `replace` so the dead path never enters the history.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}
