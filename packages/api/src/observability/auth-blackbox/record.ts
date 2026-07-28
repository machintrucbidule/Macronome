// The black-box record: a fixed-shape, fixed-order JSON object describing ONE failed
// authentication attempt in transport terms (B-231, security.md §7).
//
// Two invariants make this safe to write to disk, and both are asserted by the unit tests:
//   1. `AuthFailureFacts` admits only primitives, config values and cookie NAMES — there is no
//      field that could carry a credential, a cookie value, a session id or a username.
//   2. `buildRecord` copies nothing it was not given and emits an exact, ordered key set, so a
//      field cannot be added later without a test failing.
// Attacker-influenced strings (the forwarded proto, the peer) are clamped here, and JSON.stringify
// escapes control characters, so a crafted header cannot break the one-record-per-line format.
import type { CookieSecureMode } from '../../http/cookie-secure.js';

const MAX_FIELD_LEN = 64;

export interface AuthFailureFacts {
  at: string;
  ref: string;
  route: string;
  method: string;
  status: number;
  errorCode: string | null;
  reqSecure: boolean;
  forwardedProto: string | null;
  peer: string | null;
  peerTrusted: boolean | null;
  trustedProxy: string;
  cookieSecure: CookieSecureMode;
  cookies: string[];
  sessionFound: boolean | null;
  setCookies: string[];
}

export interface AuthBlackBoxRecord {
  at: string;
  ref: string;
  route: string;
  method: string;
  status: number;
  error_code: string | null;
  req_secure: boolean;
  x_forwarded_proto: string | null;
  peer: string | null;
  peer_trusted: boolean | null;
  trusted_proxy: string;
  cookie_secure: CookieSecureMode;
  cookies: string[];
  session_found: boolean | null;
  set_cookie: boolean;
  set_cookies: string[];
}

/** The record's key set, in emission order. The no-silent-field guard for the tests. */
export const RECORD_KEYS: readonly (keyof AuthBlackBoxRecord)[] = [
  'at',
  'ref',
  'route',
  'method',
  'status',
  'error_code',
  'req_secure',
  'x_forwarded_proto',
  'peer',
  'peer_trusted',
  'trusted_proxy',
  'cookie_secure',
  'cookies',
  'session_found',
  'set_cookie',
  'set_cookies',
];

function clamp(value: string | null): string | null {
  return value === null ? null : value.slice(0, MAX_FIELD_LEN);
}

export function buildRecord(facts: AuthFailureFacts): AuthBlackBoxRecord {
  return {
    at: facts.at,
    ref: facts.ref,
    route: facts.route,
    method: facts.method,
    status: facts.status,
    error_code: clamp(facts.errorCode),
    req_secure: facts.reqSecure,
    x_forwarded_proto: clamp(facts.forwardedProto),
    peer: clamp(facts.peer),
    peer_trusted: facts.peerTrusted,
    trusted_proxy: clamp(facts.trustedProxy) ?? '',
    cookie_secure: facts.cookieSecure,
    cookies: facts.cookies,
    session_found: facts.sessionFound,
    set_cookie: facts.setCookies.length > 0,
    set_cookies: facts.setCookies,
  };
}

/** One record, one line. */
export function serializeRecord(record: AuthBlackBoxRecord): string {
  return `${JSON.stringify(record)}\n`;
}
