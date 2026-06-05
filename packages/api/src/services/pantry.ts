import type { CreatePantryRequest, MealEntry, PantryItem } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { PantryItem as PantryItemModel } from '@prisma/client';
import { dayRepo } from '../data/repositories/day.repo.js';
import { entryRepo } from '../data/repositories/entry.repo.js';
import { foodRepo } from '../data/repositories/food.repo.js';
import { pantryRepo } from '../data/repositories/pantry.repo.js';
import { ApiError } from '../http/errors.js';
import { mealEntryDto } from './day-assembler.js';

// Pantry service (spec/api §Settings + §Meal entries pin/unpin). The garde-manger is one
// dataset seen from two places: the Paramètres editor (POST/DELETE /pantry) and the Repas
// 📌 toggle (POST /meals/:id/entries/:id/pin · /unpin). Both edit only FUTURE-day prefill
// (OPEN_GAPS #8) — never the already-materialized lines of an existing day. Dedup is the
// UNIQUE (user, meal_slot_name, food_id): a direct duplicate add → 409 pantry_duplicate;
// the 📌 toggle is idempotent.

function toDto(row: PantryItemModel): PantryItem {
  return {
    id: row.id,
    meal_slot_name: row.mealSlotName,
    food_id: row.foodId,
    order_index: row.orderIndex,
  };
}

export async function list(userId: string, mealSlotName?: string): Promise<PantryItem[]> {
  return (await pantryRepo.list(userId, mealSlotName)).map(toDto);
}

export async function create(userId: string, body: CreatePantryRequest): Promise<PantryItem> {
  if (!(await foodRepo.findById(userId, body.food_id))) {
    throw new ApiError(422, ErrorCode.ValidationError, { food_id: 'unknown_food' });
  }
  if (await pantryRepo.findByTriple(userId, body.meal_slot_name, body.food_id)) {
    throw new ApiError(409, ErrorCode.PantryDuplicate);
  }
  const orderIndex = await pantryRepo.nextOrderIndex(userId, body.meal_slot_name);
  return toDto(await pantryRepo.create(userId, body.meal_slot_name, body.food_id, orderIndex));
}

export async function remove(userId: string, id: string): Promise<boolean> {
  return pantryRepo.deleteOwned(userId, id);
}

/** Resolve an owned referenced entry + its meal slot name (for the 📌 toggle). */
async function entryPinContext(
  userId: string,
  entryId: string,
): Promise<{ entry: MealEntryModelLike; slotName: string; foodId: string } | null> {
  const entry = await entryRepo.ownedEntry(userId, entryId);
  if (!entry) return null;
  if (entry.kind !== 'referenced' || entry.foodId === null) {
    throw new ApiError(422, ErrorCode.ValidationError, { entry: 'not_pinnable' });
  }
  const meal = await dayRepo.ownedMeal(userId, entry.mealId);
  if (!meal) return null;
  return { entry, slotName: meal.slotName, foodId: entry.foodId };
}

type MealEntryModelLike = NonNullable<Awaited<ReturnType<typeof entryRepo.ownedEntry>>>;

/** Pin the entry's food on its slot (idempotent upsert) + set the line flag. */
export async function pin(userId: string, entryId: string): Promise<MealEntry | null> {
  const ctx = await entryPinContext(userId, entryId);
  if (!ctx) return null;
  if (!(await pantryRepo.findByTriple(userId, ctx.slotName, ctx.foodId))) {
    const orderIndex = await pantryRepo.nextOrderIndex(userId, ctx.slotName);
    await pantryRepo.create(userId, ctx.slotName, ctx.foodId, orderIndex);
  }
  return mealEntryDto(await entryRepo.setPinned(entryId, true));
}

/** Unpin the entry's food from its slot (future prefill only) + clear the line flag. */
export async function unpin(userId: string, entryId: string): Promise<MealEntry | null> {
  const ctx = await entryPinContext(userId, entryId);
  if (!ctx) return null;
  await pantryRepo.deleteByTriple(userId, ctx.slotName, ctx.foodId);
  return mealEntryDto(await entryRepo.setPinned(entryId, false));
}
