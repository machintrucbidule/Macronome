import { afterEach, describe, expect, it, vi } from 'vitest';
import { tap } from './haptics';

// PWA-1/B-144: haptic feedback must be a safe no-op where the Vibration API is missing
// (desktop, iOS Safari) so call sites never have to guard.
describe('haptics.tap', () => {
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    vi.restoreAllMocks();
  });

  it('calls navigator.vibrate with the given duration when supported', () => {
    const vibrate = vi.fn();
    (navigator as { vibrate?: unknown }).vibrate = vibrate;
    tap(20);
    expect(vibrate).toHaveBeenCalledWith(20);
  });

  it('no-ops when navigator.vibrate is absent', () => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    expect(() => tap()).not.toThrow();
  });

  it('swallows a throwing vibrate (e.g. called outside a user gesture)', () => {
    (navigator as { vibrate?: unknown }).vibrate = () => {
      throw new Error('no gesture');
    };
    expect(() => tap()).not.toThrow();
  });
});
