// Ciqual keep/derive/drop decision — spec/logic/ciqual-catalog.md §4.
//
// Given the four published values of one food (already parsed by parse-teneur.ts) plus its
// level-1 group code, decide whether the food enters the reference catalog and with which
// kcal figure. Pure function: plain inputs in, plain output (or null) out.

import { KCAL_PER_G } from '@macronome/shared';

/** Ciqual level-1 group `06` = "eaux et autres boissons". */
const BEVERAGE_GROUP = '06';

/** Derived kcal is rounded to one decimal (per-100 g composition precision, 00-conventions). */
const DERIVED_KCAL_DECIMALS = 1;

/** The four published values of one food; `null` = not measured (`-` in the source). */
export interface CiqualValues {
  /** Constituent 328 — energy, Reg. EU 1169/2011, kcal/100 g. */
  kcal: number | null;
  /** Constituent 40000 — fat, g/100 g. */
  fat: number | null;
  /** Constituent 31000 — carbohydrate, g/100 g. */
  carb: number | null;
  /** Constituent 25000 — protein, N × Jones, g/100 g. */
  protein: number | null;
}

/** The macro block of a catalog row, once the §4 rules have been applied. */
export interface CiqualMacros {
  kcalPer100g: number;
  fatPer100g: number;
  carbPer100g: number;
  proteinPer100g: number;
  /** True when kcal was computed from the macros rather than published (§4.2). */
  energyDerived: boolean;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Apply the keep/derive/drop rules to one food's published values.
 *
 * @returns the macro block to store, or `null` when the entry must be dropped.
 */
export function buildCatalogMacros(values: CiqualValues, groupCode: string): CiqualMacros | null {
  const { kcal, fat, carb, protein } = values;

  // §4.1 — energy published: keep it, and an unmeasured macro becomes 0. Losing a food over
  // one unmeasured macro would cost more than the zero does.
  if (kcal !== null) {
    return {
      kcalPer100g: kcal,
      fatPer100g: fat ?? 0,
      carbPer100g: carb ?? 0,
      proteinPer100g: protein ?? 0,
      energyDerived: false,
    };
  }

  // §4.3 — beverages are never derived: alcohol is not among the four constituents read, so a
  // spirit would derive to a false ~0 kcal. A missing entry beats a wrong figure.
  if (groupCode === BEVERAGE_GROUP) return null;

  // §4.4 — nothing to derive from.
  if (fat === null || carb === null || protein === null) return null;

  // §4.2 — derive from the Atwater factors.
  const derived = KCAL_PER_G.fat * fat + KCAL_PER_G.carb * carb + KCAL_PER_G.protein * protein;
  return {
    kcalPer100g: round(derived, DERIVED_KCAL_DECIMALS),
    fatPer100g: fat,
    carbPer100g: carb,
    proteinPer100g: protein,
    energyDerived: true,
  };
}
