import type { BmiCategory, Projection } from '@macronome/shared';
import { formatFixed, formatInt } from '../../lib/format/number';

// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds
// server-computed figures; it never computes one. Weights/waist → 1 decimal; BMI → 1;
// kcal → integer; activity multiplier → 2. A real minus sign is used for signed deltas;
// the magnitude uses the locale decimal mark via lib/format/number.
const MINUS = '−';
const DASH = '—';

export const kg1 = (n: number): string => formatFixed(n, 1);
export const bmi1 = (n: number): string => formatFixed(n, 1);
export const kcal0 = (n: number): string => formatInt(n);
export const mult2 = (n: number): string => `×${formatFixed(n, 2)}`;

/** Signed delta with a real minus sign: "+0,5", "−1,0", "0,0". */
export const signed1 = (n: number): string =>
  `${n > 0 ? '+' : n < 0 ? MINUS : ''}${formatFixed(Math.abs(n), 1)}`;

/** Signed integer kcal with a real minus sign: "+120", "−300", "0". */
export const signedKcal0 = (n: number): string => {
  const r = Math.round(n);
  return `${r > 0 ? '+' : r < 0 ? MINUS : ''}${formatInt(Math.abs(r))}`;
};

/** Render a nullable number through a formatter, falling back to an em dash. */
export const orDash = (n: number | null, fmt: (v: number) => string): string =>
  n === null ? DASH : fmt(n);

export { DASH };

/** BMI category → i18n key suffix (weight.bmi.<category>). */
export const bmiCategoryKey = (c: BmiCategory): string => `weight.bmi.${c}`;

/** Projection → i18n key + interpolation for the cartouche projection tile. */
export function projectionLabel(p: Projection): { key: string; date: string | null } {
  switch (p.status) {
    case 'projected':
      return { key: 'weight.projection.projected', date: p.date };
    case 'atteint':
      return { key: 'weight.projection.reached', date: null };
    case 'non_baissiere':
      return { key: 'weight.projection.flat', date: null };
    default:
      return { key: 'weight.projection.none', date: null };
  }
}
