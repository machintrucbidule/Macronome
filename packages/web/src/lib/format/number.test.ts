import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n/config';
import { formatFixed, formatInt, formatUpTo } from './number';

// Locale-aware display formatting (design/theming.md §2). Grouping is off, so integers are
// locale-independent; only the decimal mark localises (FR "," / EN "."). Rounding is half-up.
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('number formatting', () => {
  it('formats integers without grouping, rounding half-up', () => {
    expect(formatInt(1625)).toBe('1625');
    expect(formatInt(2.5)).toBe('3');
    expect(formatInt(-300)).toBe('-300');
  });

  // B-019: macro-gram amounts & target floors render as integers; a repeating float
  // (e.g. a carb ceiling) must collapse to a clean integer string, not "135.299…".
  it('collapses a repeating float to an integer (B-019)', async () => {
    expect(formatInt(135.29999999999998)).toBe('135');
    await i18n.changeLanguage('en');
    expect(formatInt(135.29999999999998)).toBe('135');
  });

  it('uses the FR decimal comma', async () => {
    await i18n.changeLanguage('fr');
    expect(formatFixed(30.5, 1)).toBe('30,5');
    expect(formatFixed(-40, 1)).toBe('-40,0');
    expect(formatFixed(0.25, 2)).toBe('0,25');
    expect(formatUpTo(30, 1)).toBe('30');
    expect(formatUpTo(30.25, 1)).toBe('30,3');
  });

  it('uses the EN decimal dot', async () => {
    await i18n.changeLanguage('en');
    expect(formatFixed(30.5, 1)).toBe('30.5');
    expect(formatUpTo(30.25, 1)).toBe('30.3');
    expect(formatInt(1625)).toBe('1625');
  });
});
