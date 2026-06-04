// Leftover proration — the "plate" deduction (spec/logic/leftover-proration.md). Pure:
// no DB, no request. BLOCK + warn, NEVER clamp (RECONCILIATION_LOG §E1). Consumed grams
// are derived, never destructively stored, so a group is freely re-editable (#13).

export type LeftoverBlockCode = 'gross_below_tare' | 'leftover_exceeds_served';

export interface MacroSnap {
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}

/** Net leftover = gross − tare (may be negative → blocked by validate). */
export function netLeftover(grossGrams: number, tareG: number): number {
  return grossGrams - tareG;
}

export type Validation = { ok: true } | { ok: false; code: LeftoverBlockCode };

/** Block when the net would be negative (gross < tare) or exceed what was served. */
export function validate(net: number, servedTotal: number): Validation {
  if (net < 0) return { ok: false, code: 'gross_below_tare' };
  if (net > servedTotal) return { ok: false, code: 'leftover_exceeds_served' };
  return { ok: true };
}

/** Consumed grams for one selected line: served − its share of the net leftover. */
export function prorateConsumed(servedGrams: number, net: number, servedTotal: number): number {
  if (servedTotal <= 0) return servedGrams;
  const allocated = (net * servedGrams) / servedTotal;
  return servedGrams - allocated;
}

/** Scale a served-quantity macro snapshot by the consumed/served ratio. */
export function scaleMacros(
  snap: MacroSnap,
  consumedGrams: number,
  servedGrams: number,
): MacroSnap {
  const ratio = servedGrams === 0 ? 0 : consumedGrams / servedGrams;
  return {
    kcal: snap.kcal * ratio,
    fat: snap.fat * ratio,
    carb: snap.carb * ratio,
    protein: snap.protein * ratio,
  };
}
