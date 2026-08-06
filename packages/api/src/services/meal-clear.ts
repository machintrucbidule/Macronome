import type { ClearMealRequest, DayDetail } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import { dayCopyRepo } from '../data/repositories/day-copy.repo.js';
import { dayRepo } from '../data/repositories/day.repo.js';
import { pantryRepo } from '../data/repositories/pantry.repo.js';
import { ApiError } from '../http/errors.js';
import { isNoOp, pinPrefillMap, planClear } from './clear-plan.js';
import { captureRestorePoint } from './day-restore-capture.js';
import { get } from './days.js';

// "Empty one meal" service (MC-1 / B-296) — the per-meal counterpart of days.clear(), built the
// same way meal-copy.ts is built next to day-copy.ts: same guarantees, narrower scope. The
// partition rule is NOT re-implemented here; it comes from clear-plan.ts, which days.clear() also
// uses, so "the day-clear rule scoped to one meal" is true by construction.
//
// Unlike the day-wide clear this leaves the day_log row alone (`resetVerdict: false`): emptying
// one meal is an edit of the day's lines, and a line edit has never cleared a forced verdict —
// the rule meal-copy.ts already records for the per-meal copy.

/**
 * POST /meals/:mealId/clear — `mode:'delete'` empties the meal but keeps its garde-manger lines
 * at qty 0; `mode:'zero'` keeps every line and sets each quantity to 0. Both dissolve the meal's
 * leftover groups. 404 unknown / another user's meal (a Partiel day carries no meals, so its ids
 * are already gone and land here too) · 409 summary_day_readonly as an unreachable safety net.
 * A meal with nothing to change is a no-op, not an error — the menu entry is disabled for it.
 */
export async function clearMeal(
  userId: string,
  mealId: string,
  mode: ClearMealRequest['mode'],
): Promise<DayDetail> {
  const target = await dayCopyRepo.mealContext(userId, mealId);
  if (!target) throw new ApiError(404, ErrorCode.NotFound);
  if (target.kind === 'summary') throw new ApiError(409, ErrorCode.SummaryDayReadonly);

  const [aggregate, pins] = await Promise.all([
    dayReadRepo.readAggregate(userId, target.date),
    pantryRepo.list(userId),
  ]);
  const meal = aggregate?.meals.find((m) => m.meal.id === mealId);
  if (!meal) return get(userId, target.date);

  const plan = planClear([meal], pinPrefillMap(pins), mode);
  // Nothing to write: answer with the day as it stands rather than burning the day's single
  // restore point on an action that changed nothing.
  if (isNoOp(plan)) return get(userId, target.date);

  // Undo point (B-261) — after the guards and after we know there is something to lose, so a
  // refused or empty call leaves the previous point intact. This is the ONE destructive action
  // with no confirmation dialog, so the undo is the whole safety net.
  await captureRestorePoint(userId, target.date, 'clear_meal');
  await dayRepo.clearDay(userId, target.date, plan, false);
  return get(userId, target.date);
}
