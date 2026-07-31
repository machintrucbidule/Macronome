import type { DayDetail } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { dayReadRepo, type DayAggregate } from '../data/repositories/day-read.repo.js';
import { dayCopyRepo, type MealContext } from '../data/repositories/day-copy.repo.js';
import { ApiError } from '../http/errors.js';
import { mealHasContent, planMeal } from './day-copy.js';
import { get } from './days.js';

// "Copy one meal from another day" service (CP-2 / B-248) — the per-meal counterpart of
// day-copy.ts. Same faithful-copy guarantees (frozen macro snapshots, leftover groups
// verbatim, garde-manger not re-applied) because it reuses that module's `planMeal`; the
// difference is the scope (one meal) and the source lookup (by name, else by position).
// Unlike the whole-day copy it leaves the day_log row alone — replacing one meal is a line
// edit, and a line edit has never cleared a forced verdict.

/** The source meal to copy: same name first, else same position. Null when neither exists. */
function matchSourceMeal(
  source: DayAggregate,
  target: MealContext,
): DayAggregate['meals'][number] | null {
  return (
    source.meals.find((m) => m.meal.slotName === target.slotName) ??
    source.meals.find((m) => m.meal.orderIndex === target.orderIndex) ??
    null
  );
}

/**
 * POST /meals/:mealId/copy-from — replace one meal with the matching meal of `from`.
 * 404 unknown/other user's meal · 409 summary_day_readonly (target is a Partiel day) ·
 * 422 when `from` is the meal's own day · 409 copy_source_empty (source day absent, empty,
 * Partiel, or the matched meal has no served line) · 409 copy_meal_not_found (the source day
 * has content but no meal matches by name or position). Nothing is written on any refusal.
 */
export async function copyMealFrom(
  userId: string,
  mealId: string,
  from: string,
): Promise<DayDetail> {
  const target = await dayCopyRepo.mealContext(userId, mealId);
  if (!target) throw new ApiError(404, ErrorCode.NotFound);
  if (target.kind === 'summary') throw new ApiError(409, ErrorCode.SummaryDayReadonly);
  if (target.date === from) {
    throw new ApiError(422, ErrorCode.ValidationError, { from: 'same_as_target' });
  }

  const source = await dayReadRepo.readAggregate(userId, from);
  // A Partiel source has no meals at all, so it lands here rather than in "no match".
  if (!source || source.dayLog.kind === 'summary' || !source.meals.some(mealHasContent)) {
    throw new ApiError(409, ErrorCode.CopySourceEmpty);
  }

  const match = matchSourceMeal(source, target);
  if (!match) throw new ApiError(409, ErrorCode.CopyMealNotFound);
  // The day has content but this meal is empty: copying it would silently wipe the target
  // (owner decision) — refuse instead, same message as an empty source day.
  if (!mealHasContent(match)) throw new ApiError(409, ErrorCode.CopySourceEmpty);

  await dayCopyRepo.copyIntoMeal(mealId, planMeal(match));
  return get(userId, target.date);
}
