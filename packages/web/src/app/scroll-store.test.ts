import { beforeEach, describe, expect, it } from 'vitest';
import { clearOffsets, offsetFor, saveOffset } from './scroll-store';

// B-268: the save/restore rule, tested directly — jsdom does not scroll, so driving this through
// a rendered tree would assert nothing.
beforeEach(clearOffsets);

describe('scroll-store (B-268)', () => {
  it('returns a remembered offset when going back', () => {
    saveOffset('k1', 1240);
    expect(offsetFor('k1', 'POP')).toBe(1240);
  });

  it('opens a screen at the top, even where an offset is remembered', () => {
    saveOffset('k1', 1240);
    expect(offsetFor('k1', 'PUSH')).toBe(0);
    expect(offsetFor('k1', 'REPLACE')).toBe(0);
  });

  it('starts at the top for a history entry it has never seen', () => {
    expect(offsetFor('unknown', 'POP')).toBe(0);
  });

  it('keeps one offset per history entry, not per screen', () => {
    saveOffset('first-visit', 300);
    saveOffset('second-visit', 900);
    expect(offsetFor('first-visit', 'POP')).toBe(300);
    expect(offsetFor('second-visit', 'POP')).toBe(900);
  });
});
