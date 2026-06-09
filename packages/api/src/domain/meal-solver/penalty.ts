// The solver objective P(q) (spec/logic/meal-solver.md §2, B-123). Pure. Given a candidate day
// aggregate + the proposal's added carb + the targets, score how far the day is from its
// hard/soft targets. The asymmetry (calorie-over > calorie-under; floors weighted high; carb
// ceiling soft) encodes D2/D3: a deficit tracker must not overshoot calories to satisfy a macro.
import { SOLVER_PENALTY } from '@macronome/shared';
import type { Macros, TargetSnapshot } from './types.js';

/**
 * Penalty breakdown for a candidate quantity vector.
 * - `hard` = the five weighted constraint terms. **`hard === 0` ⇔ full fit** — it alone decides
 *   the fit label (meal-solver.md §0 glossary / §2.3).
 * - `total` = `hard` + the deterministic `0.05·carb` tie-break, which only ranks otherwise-equal
 *   candidates (it can never block feasibility). solve.ts (S5) argmins on `total`.
 */
export interface PenaltyBreakdown {
  over: number;
  under: number;
  shortProtein: number;
  shortFat: number;
  exCarb: number;
  hard: number;
  total: number;
}

/** Compute P(q) for a day aggregate. `addedCarb` is Σ carb_i over the proposed foods (the
 *  tie-break basis); a null floor / ceiling contributes 0 (dropped constraint). */
export function penalty(
  dayAgg: Macros,
  addedCarb: number,
  targets: TargetSnapshot,
): PenaltyBreakdown {
  const over = targets.cal_max == null ? 0 : Math.max(0, dayAgg.kcal - targets.cal_max);
  const under = targets.cal_min == null ? 0 : Math.max(0, targets.cal_min - dayAgg.kcal);
  const shortProtein = shortfall(targets.protein_floor_g, dayAgg.protein);
  const shortFat = shortfall(targets.fat_floor_g, dayAgg.fat);
  const exCarb =
    targets.carb_ceiling_g == null ? 0 : Math.max(0, dayAgg.carb - targets.carb_ceiling_g);

  const hard =
    SOLVER_PENALTY.CAL_OVER * over +
    SOLVER_PENALTY.CAL_UNDER * under +
    SOLVER_PENALTY.PROTEIN_FLOOR * shortProtein +
    SOLVER_PENALTY.FAT_FLOOR * shortFat +
    SOLVER_PENALTY.CARB_CEILING * exCarb;
  const total = hard + SOLVER_PENALTY.CARB_TIEBREAK * addedCarb;

  return { over, under, shortProtein, shortFat, exCarb, hard, total };
}

/** Floor shortfall: `max(0, floor − have)`, or 0 when the floor is dropped (null). */
function shortfall(floor: number | null, have: number): number {
  if (floor == null) return 0;
  return Math.max(0, floor - have);
}
