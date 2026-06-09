// Remaining-to-target (spec/logic/meal-solver.md §1, B-123). Pure: given the day's target
// snapshot + already-entered totals, compute what is left to reach the targets. A null floor /
// ceiling is a *dropped* constraint (need = 0 / room = null). A missing calorie band means there
// is nothing to aim at → the `no_target` signal (the service maps it to 422 in S8).
import type { DayContext, Remaining } from './types.js';

export type RemainingResult =
  | { ok: true; remaining: Remaining }
  | { ok: false; reason: 'no_target' };

/** True when the day is already on target (B-124, §1 "Already on target"): within the calorie band
 *  (`rem_cal_min ≤ 0` and `rem_cal_max ≥ 0`) AND the protein/fat floors met (`need_* = 0`). The carb
 *  ceiling is soft and ignored. Lets the service short-circuit with a graceful on-target state
 *  instead of calling the model — distinct from "already over" (`rem_cal_max < 0`). */
export function isOnTarget(r: Remaining): boolean {
  return r.rem_cal_min <= 0 && r.rem_cal_max >= 0 && r.need_protein === 0 && r.need_fat === 0;
}

/** Compute day-wide remaining-to-target, or signal `no_target` when the day has no calorie band. */
export function computeRemaining(ctx: DayContext): RemainingResult {
  const { targets, entered } = ctx;
  if (targets.cal_min == null || targets.cal_max == null) {
    return { ok: false, reason: 'no_target' };
  }
  return {
    ok: true,
    remaining: {
      rem_cal_min: targets.cal_min - entered.kcal,
      rem_cal_max: targets.cal_max - entered.kcal,
      need_protein: needFloor(targets.protein_floor_g, entered.protein),
      need_fat: needFloor(targets.fat_floor_g, entered.fat),
      carb_room: targets.carb_ceiling_g == null ? null : targets.carb_ceiling_g - entered.carb,
    },
  };
}

/** Shortfall to a floor: `max(0, floor − have)`, or 0 when the floor is dropped (null). */
function needFloor(floor: number | null, have: number): number {
  if (floor == null) return 0;
  return Math.max(0, floor - have);
}
