import type { NextFunction, Request, Response } from 'express';
import { rawCookieValue, sessionWasFound } from '../../observability/auth-blackbox/index.js';
import { getDiag, markSessionFound } from '../diagnostics.js';

// Observes whether the session store actually had the session the browser presented (B-231).
//
// Mounted immediately after the session middleware and BEFORE csrf: the verdict has to be read
// before csrf mints a token into a fresh session and before a controller's elevateSession()
// regenerates the id — otherwise a login failing during elevation would be recorded as "no session
// found" when one had in fact been loaded.
//
// A no-op on every request that is not a genuine authentication attempt (one property read).
export function sessionDiagnostics(req: Request, res: Response, next: NextFunction): void {
  if (getDiag(res)) {
    const presented = rawCookieValue(req.headers.cookie, 'macronome.sid');
    markSessionFound(res, sessionWasFound(presented, req.sessionID));
  }
  next();
}
