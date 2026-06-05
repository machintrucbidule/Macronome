import type { Food } from '@macronome/shared';
import { formatInt, formatUpTo } from '../../lib/format/number';

// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds
// for display; it never computes nutrition figures. kcal → integer (round half-up);
// macro grams → up to 1 decimal. Locale decimal mark via lib/format/number.

export function kcalDisplay(n: number): string {
  return formatInt(n);
}

export function gramsDisplay(n: number): string {
  return formatUpTo(n, 1);
}

/** "label = 15 g · dose = 30 g" or an em-dash when a food has no named portions. */
export function portionSummary(portions: Food['named_portions']): string {
  if (portions.length === 0) return '—';
  return portions.map((p) => `${p.label} = ${gramsDisplay(p.grams)} g`).join(' · ');
}
