import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { deriveCookieSecure } from '../cookie-secure.js';

// Second half of the per-request `Secure` derivation (B-232). The `cookie` option in session.ts is
// a function of the request, but express-session only calls it for NEW sessions (index.js:161): a
// session loaded from the store gets its attributes restored FROZEN from the stored row
// (Store.createSession → new Cookie(sess.cookie)). So a session created over plain HTTP would keep
// `secure:false` for its whole week, even once the operator puts an HTTPS proxy in front.
//
// Mutating `req.session.cookie.secure` here fixes that: express-session reads it when it writes the
// Set-Cookie header (its onHeaders hook), and `hash()` skips the `cookie` key, so this marks nothing
// as modified — no extra store write, no interaction with resave/rolling.
//
// The `?.` guard is load-bearing: with the store unreachable, express-session calls next() without
// creating `req.session` at all.
export function applySessionCookieSecure(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.cookie) {
    req.session.cookie.secure = deriveCookieSecure(env.COOKIE_SECURE, req.secure === true);
  }
  next();
}
