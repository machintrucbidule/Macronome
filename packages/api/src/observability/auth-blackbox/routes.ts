// Which requests count as a genuine authentication attempt, i.e. a deliberate act by a human that
// is worth one black-box line when it fails (B-231, owner decision).
//
// Deliberately excluded: `GET /auth/session` (the SPA's "am I signed in?" probe, which answers 401
// on every anonymous page load — recording it would bury the anomaly under normal traffic),
// `GET /auth/setup-state`, `POST /auth/token-state` and `POST /auth/logout`.
//
// The gate returns the CANONICAL route string, never `req.originalUrl`. That guarantees the
// recorded `route` can only ever be one of these five compile-time constants, so no query string,
// path segment or user-supplied text can reach the file through it.
const GENUINE_AUTH_ROUTES = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/setup',
  '/api/v1/auth/register',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/password',
]);

/** The canonical route when this is a genuine authentication attempt, else null. */
export function genuineAuthRoute(method: string, path: string): string | null {
  if (method.toUpperCase() !== 'POST') return null;
  const normalised = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return GENUINE_AUTH_ROUTES.has(normalised) ? normalised : null;
}

/** Exposed for tests and documentation; not for matching (use genuineAuthRoute). */
export function genuineAuthRoutes(): string[] {
  return [...GENUINE_AUTH_ROUTES];
}
