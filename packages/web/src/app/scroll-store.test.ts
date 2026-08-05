import { beforeEach, describe, expect, it } from 'vitest';
import { clearOffsets, offsetFor, saveOffset } from './scroll-store';

// B-268/B-277: the save/restore rule, tested directly — jsdom does not scroll, so driving this
// through a rendered tree would assert nothing.
beforeEach(clearOffsets);

describe('scroll-store (B-277)', () => {
  it('returns a screen to where it was left', () => {
    saveOffset('/foods', 1240);
    expect(offsetFor('/foods')).toBe(1240);
  });

  it('restores however you came back — a nav click is not a browser Back', () => {
    // The regression this fixes: a food's detail is a modal, not a route, so returning to Aliments
    // is always a PUSH. Keying on the history entry meant only the Back button ever restored.
    saveOffset('/foods', 900);
    expect(offsetFor('/foods')).toBe(900);
    expect(offsetFor('/foods')).toBe(900); // idempotent: reading does not consume it
  });

  it('opens a screen never visited this session at the top', () => {
    expect(offsetFor('/recipes')).toBe(0);
  });

  it('keeps one offset per screen', () => {
    saveOffset('/foods', 300);
    saveOffset('/history', 900);
    expect(offsetFor('/foods')).toBe(300);
    expect(offsetFor('/history')).toBe(900);
  });

  it('forgets everything when the session is cleared', () => {
    saveOffset('/foods', 300);
    clearOffsets();
    expect(offsetFor('/foods')).toBe(0);
  });
});
