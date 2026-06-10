// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds for
// display; it never computes nutrition figures (CLAUDE.md rule 2). kcal → integer; macro
// grams / weights → 1 decimal. Locale-aware separators are an M9 polish item.

export function kcalDisplay(n: number): string {
  return Math.round(n).toString();
}

export function gramsDisplay(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// Whole-gram display for the compact mobile recipe card meta (Lot / g·portion), where the
// 1-decimal precision is noise on large weights (owner decision, 2026-06-10). Display-only.
export function gramsInt(n: number): string {
  return Math.round(n).toString();
}
