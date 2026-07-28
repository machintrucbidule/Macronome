// Whether a cookie carries `Secure`, decided per request (B-232). Pure and env-free so the
// three-state truth table is pinned by unit tests (precedent: http/origin-resolve.ts).
//
// `auto` is the default because it is the only mode that cannot lock the operator out: it marks
// the cookie Secure exactly when the server already sees the request as HTTPS, which is the same
// input express-session uses to decide whether it will emit a Secure cookie at all.
//
// PUBLIC_ORIGIN is deliberately NOT an input, and must not become one. express-session gates
// emission on `issecure(req)` (index.js:242), which a declared origin cannot influence — so
// marking Secure because PUBLIC_ORIGIN is https, while the proxy is untrusted, would make the
// server silently emit no session cookie and every login fail as a misleading 403 CSRF. That is
// exactly the B-222 lockout this derivation exists to prevent. See security.md §4, DECISIONS.md.
export type CookieSecureMode = 'auto' | 'true' | 'false';

export function deriveCookieSecure(mode: CookieSecureMode, reqSecure: boolean): boolean {
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  return reqSecure;
}
