import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { env } from '../../config/env.js';
import { ApiError } from '../errors.js';

// Double-submit CSRF defence (security.md §4). A per-session token is mirrored to a
// readable (non-HttpOnly) cookie; state-changing requests must echo it in a header.
// SameSite=Lax on the session cookie is the first line; this token is depth.
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrf(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.cookie('macronome.csrf', req.session.csrfToken, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
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
