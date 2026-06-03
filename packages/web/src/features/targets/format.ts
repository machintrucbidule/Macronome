// Display formatting only (spec/logic/00-conventions.md §Rounding). The web rounds
// server-computed figures for display; it never computes a nutrition figure. kcal →
// integer; macro grams → 1 decimal; g/kg ratios → 2 decimals; rates (kg/week) → 2;
// activity multiplier → 2. Locale-aware decimal marks are an M9 polish item.

export const kcal = (n: number): string => Math.round(n).toString();

/** Signed kcal (e.g. deficit): "−76", "+40", "0". Uses a real minus sign. */
export const signedKcal = (n: number): string => {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r.toString();
};

export const grams1 = (n: number): string => n.toFixed(1);

export const ratio2 = (n: number): string => n.toFixed(2);

export const rate2 = (n: number): string => n.toFixed(2);

export const multiplier2 = (n: number): string => `×${n.toFixed(2)}`;
