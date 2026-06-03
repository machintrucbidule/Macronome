// Energy conversion constants — single source of truth, imported by `api` (to
// compute) and `web` (to label/format). No calculation lives here; `shared` holds
// the magic numbers only (see docs/architecture/context-files/shared-CLAUDE.md).
// Source: spec/logic/00-conventions.md (energy 9/4/4), DECISIONS.md (7700 kcal/kg).

/** Atwater factors: kcal per gram of each macronutrient. */
export const KCAL_PER_G = {
  fat: 9,
  carb: 4,
  protein: 4,
} as const;

/** Energy equivalent of one kilogram of body mass. */
export const KCAL_PER_KG = 7700;
