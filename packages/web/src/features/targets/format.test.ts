import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n/config';
import { grams1, macroG } from './format';

// B-019: the Cibles engine macro floors/ceilings (protein/fat floor, carb ceiling) display
// as integers, while body weight stays at 1 decimal. Locks the rounding split.
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('targets format (B-019)', () => {
  it('renders macro floors/ceilings as integers (round half-up)', () => {
    expect(macroG(130.4)).toBe('130');
    expect(macroG(130.5)).toBe('131');
    expect(macroG(135.29999999999998)).toBe('135');
  });

  it('keeps body weight at 1 decimal (unchanged)', () => {
    expect(grams1(82.45)).toBe('82,5');
  });
});
