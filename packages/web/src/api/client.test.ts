import { afterEach, describe, expect, it } from 'vitest';
import { isWithinLoginGrace, markLoginSuccess } from './client';

// B-218: the post-login grace window suppresses the hard /login redirect on a transient
// protected-page 401 during cookie propagation. Verified via the pure predicate seam (no
// jsdom window.location mocking needed): the window opens on a successful login and closes
// after LOGIN_GRACE_MS (5000). `now` is injected so the assertions are deterministic.
describe('post-login grace window (B-218)', () => {
  afterEach(() => {
    // Close the window far in the past so it never leaks into other tests.
    markLoginSuccess(-1_000_000);
  });

  it('is open immediately after a successful login', () => {
    markLoginSuccess(1000);
    expect(isWithinLoginGrace(1500)).toBe(true);
  });

  it('closes once the grace period has elapsed', () => {
    markLoginSuccess(1000);
    expect(isWithinLoginGrace(1000 + 5000 + 1)).toBe(false);
  });

  it('is closed when no login has occurred', () => {
    markLoginSuccess(-1_000_000);
    expect(isWithinLoginGrace(0)).toBe(false);
  });
});
