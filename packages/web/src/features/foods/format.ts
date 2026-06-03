import type { Food } from '@macronome/shared';

// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds
// for display; it never computes nutrition figures. kcal → integer (round half-up);
// macro grams → 1 decimal. Locale-aware decimal separators are an M9 polish item.

export function kcalDisplay(n: number): string {
  return Math.round(n).toString();
}

export function gramsDisplay(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** "label = 15 g · dose = 30 g" or an em-dash when a food has no named portions. */
export function portionSummary(portions: Food['named_portions']): string {
  if (portions.length === 0) return '—';
  return portions.map((p) => `${p.label} = ${gramsDisplay(p.grams)} g`).join(' · ');
}
