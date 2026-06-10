import { describe, expect, it } from 'vitest';
import { swipeIntent } from './useMealSwipe';

// Pure swipe-decision contract (the gesture wiring itself is verified by inspection at the
// breakpoint, per the mobile-responsive plan — no layout unit tests).
describe('swipeIntent', () => {
  it('returns +1 (next meal) for a long left swipe', () => {
    expect(swipeIntent(-80, 5)).toBe(1);
  });

  it('returns -1 (previous meal) for a long right swipe', () => {
    expect(swipeIntent(80, -5)).toBe(-1);
  });

  it('ignores a horizontal move shorter than the threshold', () => {
    expect(swipeIntent(20, 0)).toBe(0);
    expect(swipeIntent(-20, 0)).toBe(0);
  });

  it('ignores a vertically dominant move (a scroll, not a swipe)', () => {
    expect(swipeIntent(60, 100)).toBe(0);
    expect(swipeIntent(-60, -90)).toBe(0);
  });

  it('honours a custom threshold', () => {
    expect(swipeIntent(30, 0, 25)).toBe(-1); // clears the lower threshold → right swipe
    expect(swipeIntent(30, 0, 40)).toBe(0); // below the higher threshold → ignored
  });
});
