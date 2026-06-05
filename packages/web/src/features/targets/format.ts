import { formatFixed, formatInt } from '../../lib/format/number';

// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds
// server-computed figures for display; it never computes a nutrition figure. kcal →
// integer; macro grams → 1 decimal; g/kg ratios → 2 decimals; rates (kg/week) → 2;
// activity multiplier → 2. Locale decimal mark via lib/format/number.

export const kcal = (n: number): string => formatInt(n);

/** Signed kcal (e.g. deficit): "−76", "+40", "0". Uses a real minus sign. */
export const signedKcal = (n: number): string => {
  const r = Math.round(n);
  return r > 0 ? `+${formatInt(r)}` : formatInt(r);
};

export const grams1 = (n: number): string => formatFixed(n, 1);

export const ratio2 = (n: number): string => formatFixed(n, 2);

export const rate2 = (n: number): string => formatFixed(n, 2);

export const multiplier2 = (n: number): string => `×${formatFixed(n, 2)}`;
