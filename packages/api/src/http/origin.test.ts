import { expect, test } from 'vitest';
import { resolveOrigin } from './origin-resolve.js';

// Pure oracles for the public-origin resolution used by the Google Drive OAuth callback (B-217).
// PUBLIC_ORIGIN, when set, is used verbatim (robust behind a reverse proxy/tunnel); else the
// origin is derived from the request scheme/host. The env-bound wrappers (deriveOrigin/
// isHttpsOrigin) are thin and exercised by the integration test; here we test the pure core.

const req = (protocol: string, host: string): { protocol: string; get(n: string): string } => ({
  protocol,
  get: () => host,
});

test('PUBLIC_ORIGIN set → used verbatim, trailing slash trimmed', () => {
  expect(resolveOrigin('https://macronome.example.com', req('http', 'internal:3000'))).toBe(
    'https://macronome.example.com',
  );
  expect(resolveOrigin('https://macronome.example.com/', req('http', 'internal:3000'))).toBe(
    'https://macronome.example.com',
  );
});

test('PUBLIC_ORIGIN unset → derived from the request scheme + host', () => {
  expect(resolveOrigin(undefined, req('https', 'app.example.com'))).toBe('https://app.example.com');
  expect(resolveOrigin(undefined, req('http', 'localhost:3000'))).toBe('http://localhost:3000');
});

test('HTTPS gate follows the resolved origin, not req.secure', () => {
  // Server sees http (proxy proto not trusted) but PUBLIC_ORIGIN is https → gate passes.
  expect(resolveOrigin('https://app.example.com', req('http', 'x')).startsWith('https://')).toBe(
    true,
  );
  // No PUBLIC_ORIGIN and http request → gate fails.
  expect(resolveOrigin(undefined, req('http', 'x')).startsWith('https://')).toBe(false);
});
