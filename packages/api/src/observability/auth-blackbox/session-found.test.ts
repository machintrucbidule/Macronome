import { describe, expect, it } from 'vitest';
import { sessionWasFound } from './session-found.js';

// B-231: the three outcomes are what separate a store problem from a cookie problem. `null` (the
// session middleware never completed) is the case that matters most — it is what a failure upstream
// of the session looks like, and reporting it as `false` would be a lie.
describe('sessionWasFound', () => {
  it('is null when the session middleware never ran', () => {
    expect(sessionWasFound('s%3Aabc.def', undefined)).toBeNull();
    expect(sessionWasFound(undefined, undefined)).toBeNull();
  });

  it('is false when no session cookie was presented', () => {
    expect(sessionWasFound(undefined, 'abc')).toBe(false);
  });

  it('is true when the presented signed cookie carries this session id', () => {
    expect(sessionWasFound('s:abc.SIGNATURE', 'abc')).toBe(true);
  });

  // Presented but not found: express-session replaced the id via generate(), i.e. the store had no
  // row for it. This is the signature of a session lost server-side.
  it('is false when the presented cookie is for a different session', () => {
    expect(sessionWasFound('s:stale.SIGNATURE', 'fresh')).toBe(false);
  });
});
