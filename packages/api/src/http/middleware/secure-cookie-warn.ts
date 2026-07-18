import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';

// Startup guard for the "Secure cookies + untrusted proxy" trap. When COOKIE_SECURE=true but a
// request is seen as insecure (req.secure=false — the frontal's X-Forwarded-Proto is ignored
// because TRUSTED_PROXY does not cover it), express-session silently drops the session cookie and
// every login fails as a misleading 403 CSRF. This logs once, actionably, so the misconfig is
// obvious instead of costing hours. Depends on trust-proxy being applied (req.secure meaningful).
let warned = false;

export function secureCookieWarn(req: Request, _res: Response, next: NextFunction): void {
  if (!warned && env.COOKIE_SECURE && !req.secure) {
    warned = true;
    logger.warn(
      { cookieSecure: true, reqSecure: false, trustedProxy: env.TRUSTED_PROXY },
      'COOKIE_SECURE=true but a request was seen as insecure (req.secure=false): session cookies ' +
        'will NOT be set and logins will fail. Set TRUSTED_PROXY to trust your reverse proxy ' +
        '(behind Docker + a tunnel: uniquelocal), or set COOKIE_SECURE=false.',
    );
  }
  next();
}

// Test-only: reset the one-shot latch between cases.
export function resetSecureCookieWarn(): void {
  warned = false;
}
