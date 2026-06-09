// Meal-solver domain types (spec/logic/meal-solver.md §1–§4, B-123). Pure data shapes for the
// deterministic accountant + verifier; no logic, no I/O, no user scope. SI units throughout
// (kcal + grams). The LLM (chef) picks foods qualitatively; these types carry the numbers the
// solver and verifier compute against.
import type { Rating } from '@macronome/shared';

/** A macro tuple in SI units: energy (kcal) + macronutrient grams. */
export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
}

/**
 * The day's frozen target snapshot (mirrors `GET /days/:date` `target_snapshot`). Floors and the
 * ceiling are nullable: per targets-macros.md they require a current weight + Target, and a null
 * one is a *dropped* constraint (treated satisfied). `cal_min`/`cal_max` are nullable to model a
 * day with no Target at all (→ the `no_target` signal in remaining.ts).
 */
export interface TargetSnapshot {
  cal_min: number | null;
  cal_max: number | null;
  protein_floor_g: number | null;
  fat_floor_g: number | null;
  carb_ceiling_g: number | null;
}

/** Everything the proposal must fit into: the target snapshot + the day-wide already-entered
 *  totals (the aggregate of every entry across all meals, `GET /days/:date` `totals`). */
export interface DayContext {
  targets: TargetSnapshot;
  entered: Macros;
}

/** Day-wide remaining-to-target, derived in remaining.ts. `carb_room` is null when the ceiling is
 *  dropped (no constraint). Floors that are dropped surface as `need_* = 0`. */
export interface Remaining {
  rem_cal_min: number;
  rem_cal_max: number;
  need_protein: number;
  need_fat: number;
  carb_room: number | null;
}

/** A food the solver may set a quantity for — one LLM-picked food line already assigned to a
 *  selected meal. `per100g` are the food's stored per-100 g values (the calorie-axis basis,
 *  meal-solver.md §2). `portion` is the chosen named portion, or null for a portionless food. */
export interface SolverCandidate {
  food_id: string;
  meal_id: string;
  food_name: string;
  rating: Rating;
  per100g: Macros;
  portion: { portion_id: string; label: string; grams: number } | null;
}

/** A solved quantity for one candidate. `count` = whole-portion count (indivisible) for a
 *  portioned food, null for a portionless one; `grams` is the resolved served grams either way
 *  (`count × portion.grams` when portioned). Produced by solve.ts (S5); consumed by verify.ts. */
export interface SolvedQuantity {
  candidate: SolverCandidate;
  count: number | null;
  grams: number;
}
