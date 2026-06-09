import type { MealTotals, TargetSnapshot } from '@macronome/shared';

// Display-only preview of the day-wide remaining targets shown in the request popup BEFORE the
// AI call (mirrors spec/logic/meal-solver.md §2.1: cal band − entered, max(0, floor − entered),
// ceiling − entered; a null floor/ceiling stays null and renders "—"). This is framing only —
// the AUTHORITATIVE remaining used by the solver and shown with the proposals is computed
// server-side and returned in the meal-suggestions response (CLAUDE.md rule 2).
export interface RemainingPreview {
  calMin: number;
  calMax: number;
  needProtein: number | null;
  needFat: number | null;
  carbRoom: number | null;
}

export function previewRemaining(target: TargetSnapshot, totals: MealTotals): RemainingPreview {
  const floor = (f: number | null, eaten: number): number | null =>
    f === null ? null : Math.max(0, f - eaten);
  return {
    calMin: target.cal_min - totals.kcal,
    calMax: target.cal_max - totals.kcal,
    needProtein: floor(target.protein_floor_g, totals.protein),
    needFat: floor(target.fat_floor_g, totals.fat),
    carbRoom: target.carb_ceiling_g === null ? null : target.carb_ceiling_g - totals.carb,
  };
}
