// Remaining-to-target (spec/logic/meal-solver.md §1, B-123). Pure: given the day's target
// snapshot + already-entered totals, compute what is left to reach the targets. A null floor /
// ceiling is a *dropped* constraint (need = 0 / room = null). A missing calorie band means there
// is nothing to aim at → the `no_target` signal (the service maps it to 422 in S8).
import type { DayContext, Remaining } from './types.js';

export type RemainingResult =
  | { ok: true; remaining: Remaining }
  | { ok: false; reason: 'no_target' };

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
