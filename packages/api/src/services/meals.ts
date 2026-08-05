import type { CreateMealRequest, PatchMealRequest } from '@macronome/shared';
import type { Meal as MealModel } from '@prisma/client';
import { dayRepo } from '../data/repositories/day.repo.js';
import { captureRestorePoint } from './day-restore-capture.js';
import { materialize } from './days.js';

// Meals service (spec/api/days-meals-leftover.md §Meals). A meal is this day's own
// ordered slot — editing it never touches the meal_slot_template (M7). Creating one
// materializes the day first so the day_log exists. Ownership is verified in the repo
// (meal → day_log.user_id). Returns a slim meal shape; the client refetches the day.

export interface MealSummary {
  id: string;
  slot_name: string;
  order_index: number;
}

const toSummary = (m: MealModel): MealSummary => ({
  id: m.id,
  slot_name: m.slotName,
  order_index: m.orderIndex,
});

/** POST /days/:date/meals — add a meal to (materializing) the day. */
export async function create(
  userId: string,
  date: string,
  body: CreateMealRequest,
): Promise<MealSummary> {
  await materialize(userId, date);
  const day = await dayRepo.findDay(userId, date);
  const meal = await dayRepo.createMeal(day!.id, body.slot_name, body.order_index);
  return toSummary(meal);
}

/** PATCH /days/:date/meals/:mealId — rename / reorder (this day only). */
export async function patch(
  userId: string,
  mealId: string,
  body: PatchMealRequest,
): Promise<MealSummary | null> {
  const meal = await dayRepo.updateMeal(userId, mealId, {
    ...(body.slot_name !== undefined ? { slotName: body.slot_name } : {}),
    ...(body.order_index !== undefined ? { orderIndex: body.order_index } : {}),
  });
  return meal ? toSummary(meal) : null;
}

/** DELETE /days/:date/meals/:mealId — drop the meal (entries + leftover groups cascade).
 *  Captures the WHOLE day as an undo point first (B-261): nothing narrower could bring back
 *  the cascaded leftover groups. Ownership is still the repo's call, so a cross-tenant id
 *  writes no point — the capture only runs once the meal is known to be the user's. */
export async function remove(userId: string, date: string, mealId: string): Promise<boolean> {
  const owned = await dayRepo.ownedMeal(userId, mealId);
  if (!owned) return false;
  await captureRestorePoint(userId, date, 'delete_meal');
  return dayRepo.deleteMeal(userId, mealId);
}
