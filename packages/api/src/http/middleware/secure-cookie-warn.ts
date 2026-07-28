import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';
import { createThrottle } from '../../observability/warn-throttle.js';

// Guard for the "Secure cookies + untrusted proxy" trap. When COOKIE_SECURE is forced to `true` but
// a request is seen as insecure (req.secure=false — the frontal's X-Forwarded-Proto is ignored
// because TRUSTED_PROXY does not cover it), express-session silently drops the session cookie and
// every login fails as a misleading 403 CSRF. This says so, actionably, so the misconfiguration is
// obvious instead of costing a morning.
//
// Since B-232 this is the ONLY remaining path into the trap: with the default `auto`, `Secure` is
// derived from the same signal express-session gates emission on, so the two can never disagree.
//
// Throttled rather than one-shot (B-231, prescribed work 3): the previous module-level `warned` flag
// never reset, so an unrelated early request could consume the single warning and the real problem
// would then never be reported for the life of the process. A throttle re-arms.
const WARN_INTERVAL_MS = 10 * 60 * 1000;

let gate = createThrottle(WARN_INTERVAL_MS);

export function secureCookieWarn(req: Request, _res: Response, next: NextFunction): void {
  if (env.COOKIE_SECURE === 'true' && !req.secure && gate.allow(Date.now())) {
    logger.warn(
      {
        cookieSecure: env.COOKIE_SECURE,
        reqSecure: false,
        trustedProxy: env.TRUSTED_PROXY,
        suppressed: gate.drain(),
      },
      'COOKIE_SECURE=true but a request was seen as insecure (req.secure=false): session cookies ' +
        'will NOT be set and logins will fail. You no longer need to force it — the default ' +
        'COOKIE_SECURE=auto marks cookies Secure by itself once the request is seen as HTTPS. ' +
        'Either remove the override, or set TRUSTED_PROXY to cover your reverse proxy (behind ' +
        'Docker + a tunnel: uniquelocal).',
    );
  }
  next();
}

// Test-only: reopen the throttle window between cases.
export function resetSecureCookieWarn(): void {
  gate = createThrottle(WARN_INTERVAL_MS);
}
