import { describe, expect, it } from 'vitest';
import { deriveCookieSecure } from './cookie-secure.js';

// B-232: the three-state truth table. `auto` follows the request, `true` forces, `false` disables.
describe('deriveCookieSecure', () => {
  it('auto: no Secure when the request is not seen as HTTPS', () => {
    expect(deriveCookieSecure('auto', false)).toBe(false);
  });

  it('auto: Secure when the request is seen as HTTPS (the automatic hardening)', () => {
    expect(deriveCookieSecure('auto', true)).toBe(true);
  });

  it('true: forces Secure even on a request seen as plain HTTP (the B-222 trap)', () => {
    expect(deriveCookieSecure('true', false)).toBe(true);
  });

  it('false: never Secure, even over HTTPS — the operator unblocking lever', () => {
    expect(deriveCookieSecure('false', true)).toBe(false);
    expect(deriveCookieSecure('false', false)).toBe(false);
  });

  // Guard rail, not a behaviour test. Adding PUBLIC_ORIGIN as an input would mark cookies Secure
  // while express-session still refuses to emit them (index.js:242 gates on the request), which is
  // precisely the B-222 lockout. Keep the signature at two parameters.
  it('takes only (mode, reqSecure) — PUBLIC_ORIGIN must never be an input', () => {
    expect(deriveCookieSecure.length).toBe(2);
  });
});
