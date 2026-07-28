import type { Response } from 'express';

// Per-request diagnostic state for the authentication black box (B-231), parked on `res.locals`.
//
// It lives outside middleware/ so both errorHandler.ts and the diagnostics middlewares can use it
// without an import cycle, and so there is exactly ONE place where a `ref` enters a response body —
// otherwise the terminal error handler and the rate limiter (which writes its 429 itself, bypassing
// the handler) would drift apart.
export interface AuthDiag {
  ref: string;
  route: string;
  sessionFound: boolean | null;
}

/** Begin tracking a genuine authentication attempt. */
export function startDiag(res: Response, route: string, ref: string): void {
  res.locals.diag = { ref, route, sessionFound: null };
}

export function getDiag(res: Response): AuthDiag | undefined {
  return res.locals.diag;
}

/** Record the session verdict once; the first observation wins (a later regenerate must not erase it). */
export function markSessionFound(res: Response, found: boolean | null): void {
  const diag = res.locals.diag;
  if (diag && diag.sessionFound === null) diag.sessionFound = found;
}

/** Remember the contract error code the response settled on, for the record. */
export function recordErrorCode(res: Response, code: string): void {
  res.locals.errorCode = code;
}

/** Attach the diagnostic ref to an outgoing error body, when this request has one. */
export function attachRef(res: Response, error: { ref?: string }): void {
  const diag = res.locals.diag;
  if (diag) error.ref = diag.ref;
}
