import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { env } from '../../config/env.js';
import { deriveCookieSecure } from '../cookie-secure.js';
import { ApiError } from '../errors.js';

// Double-submit CSRF defence (security.md §4). A per-session token is mirrored to a
// readable (non-HttpOnly) cookie; state-changing requests must echo it in a header.
// SameSite=Lax on the session cookie is the first line; this token is depth.
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrf(req: Request, res: Response, next: NextFunction): void {
  // No session means the store was unreachable and session-guard.ts let a document request through
  // so the SPA can still load (B-231). There is no token to mint or check; state-changing API calls
  // never reach here in that state — they were already answered 503.
  if (!req.session) {
    next();
    return;
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.cookie('macronome.csrf', req.session.csrfToken, {
    httpOnly: false,
    secure: deriveCookieSecure(env.COOKIE_SECURE, req.secure === true),
    sameSite: 'lax',
    path: '/',
  });

  if (STATE_CHANGING.has(req.method.toUpperCase())) {
    const header = req.get('x-csrf-token');
    if (!header || header !== req.session.csrfToken) {
      next(new ApiError(403, ErrorCode.CsrfInvalid));
      return;
    }
  }
  next();
}
