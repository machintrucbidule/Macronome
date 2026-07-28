import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import {
  appendAuthFailure,
  buildRecord,
  cookieNamesFromHeader,
  genuineAuthRoute,
  newRef,
  setCookieNames,
  type AuthFailureFacts,
} from '../../observability/auth-blackbox/index.js';
import { getDiag, startDiag } from '../diagnostics.js';

// The authentication black box (B-231). Assigns a diagnostic ref to every genuine authentication
// attempt and, when the response fails, writes one durable record to the app data volume.
//
// MOUNTED EARLY — before express.json and before the session middleware (app.ts). That placement is
// the whole point: the `finish` listener must already be registered when the failure happens
// upstream of the routes (a body-parse error, a session-store error, an unreachable database), which
// is precisely the class of outage that left no trace twice. Those responses still reach res.end, so
// the record lands with `session_found:null` and the real status.
//
// It needs no request body: recording the username is forbidden (security.md §7), so nothing pulls
// this after the parser.

// Express's compiled trust-proxy predicate, so the recorded verdict IS the verdict the framework
// used rather than a re-derivation that could disagree with it.
type TrustFn = (addr: string, index: number) => boolean;

function peerTrusted(req: Request, peer: string | null): boolean | null {
  if (peer === null) return null;
  const trust = req.app.get('trust proxy fn') as TrustFn | undefined;
  return trust ? trust(peer, 0) : null;
}

function collectFacts(req: Request, res: Response, route: string, ref: string): AuthFailureFacts {
  // The TCP peer, deliberately not req.ip: req.ip may already be the forwarded client address, and
  // what names a proxy misconfiguration is which peer actually connected.
  const peer = req.socket.remoteAddress ?? null;
  return {
    at: new Date().toISOString(),
    ref,
    route,
    method: req.method.toUpperCase(),
    status: res.statusCode,
    errorCode: res.locals.errorCode ?? null,
    reqSecure: req.secure === true,
    forwardedProto: req.get('x-forwarded-proto') ?? null,
    peer,
    peerTrusted: peerTrusted(req, peer),
    trustedProxy: env.TRUSTED_PROXY,
    cookieSecure: env.COOKIE_SECURE,
    cookies: cookieNamesFromHeader(req.headers.cookie),
    sessionFound: getDiag(res)?.sessionFound ?? null,
    setCookies: setCookieNames(res.getHeader('set-cookie')),
  };
}

export function authDiagnostics(req: Request, res: Response, next: NextFunction): void {
  const route = genuineAuthRoute(req.method, req.path);
  if (!route) {
    next();
    return;
  }

  const ref = newRef();
  startDiag(res, route, ref);

  // `finish` rather than an onHeaders hook: by the time it fires, writeHead has already run every
  // Set-Cookie writer (express-session's included), so the emitted cookies can simply be read back
  // with no listener-ordering reasoning. `close` is deliberately not hooked — a failed attempt
  // always produces a response, and hooking both would risk a duplicate record.
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    appendAuthFailure(buildRecord(collectFacts(req, res, route, ref)));
  });

  next();
}
