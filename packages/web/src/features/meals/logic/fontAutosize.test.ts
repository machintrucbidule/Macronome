import { describe, expect, it } from 'vitest';
import { COOK_FONT_MAX, COOK_FONT_MIN, fontForHeight } from './fontAutosize';

// Cook-mode font heuristic oracle: fs = clamp(16, floor(h / n * 0.34), 40).
describe('fontForHeight', () => {
  it('scales with the available height and line count', () => {
    // 520 / 4 = 130 → floor(130 * 0.34) = 44 → clamped to 40
    expect(fontForHeight(520, 4)).toBe(COOK_FONT_MAX);
    // 520 / 8 = 65 → floor(65 * 0.34) = 22
    expect(fontForHeight(520, 8)).toBe(22);
  });

  it('clamps to the 16–40 px band', () => {
    expect(fontForHeight(100, 8)).toBe(COOK_FONT_MIN); // 100/8*0.34 = 4.25 → 16 floor
    expect(fontForHeight(4000, 1)).toBe(COOK_FONT_MAX); // huge → 40 ceiling
  });

  it('treats zero or fewer lines as one (no divide-by-zero)', () => {
    expect(fontForHeight(300, 0)).toBe(fontForHeight(300, 1));
    expect(fontForHeight(300, -5)).toBe(fontForHeight(300, 1));
  });
});
