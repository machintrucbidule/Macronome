import type {
  CreateMealEntryRequest,
  MealEntry,
  MoveEntryRequest,
  ReorderEntriesRequest,
  UpdateMealEntryRequest,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { MealEntry as MealEntryModel } from '@prisma/client';
import { dayRepo } from '../data/repositories/day.repo.js';
import { entryRepo, type EntryWriteData } from '../data/repositories/entry.repo.js';
import { foodRepo, type FoodWithPortions } from '../data/repositories/food.repo.js';
import { leftoverRepo } from '../data/repositories/leftover.repo.js';
import { resolveServedGrams, snapshotMacros, type ServingUnit } from '../domain/serving/index.js';
import { ApiError } from '../http/errors.js';
import { mealEntryDto } from './day-assembler.js';
import { syncUnitFromPinnedEntry } from './pantry.js';

// Meal-entries service (spec/api/days-meals-leftover.md §Meal entries). The server
// RESOLVES served_grams and the macro SNAPSHOT at write time (domain/serving), freezing
// the line against later food edits. Ownership is verified before any write (meal → day_
// log.user_id). Custom lines may be weightless (no served_grams) and carry entered macros.

const num = (d: { toString(): string }): number => Number(d.toString());

/** Grams + snapshot for a referenced food line (422 on a bad portion). */
function resolveReferenced(
  food: FoodWithPortions,
  quantity: number,
  unit: ServingUnit,
  portionId: string | null,
): { servedGrams: number; snap: EntryWriteData } {
  let portionGrams: number | null = null;
  if (unit === 'portion') {
    const portion = food.portions.find((p) => p.id === portionId);
    if (!portion)
      throw new ApiError(422, ErrorCode.ValidationError, { portion_id: 'invalid_portion' });
    portionGrams = num(portion.grams);
  }
  const servedGrams = resolveServedGrams({ unit, quantity, portionGrams });
  const macros = snapshotMacros(
    {
      kcal: num(food.kcalPer100g),
      fat: num(food.fatPer100g),
      carb: num(food.carbPer100g),
      protein: num(food.proteinPer100g),
    },
    servedGrams,
  );
  return {
    servedGrams,
    snap: {
      kind: 'referenced',
      foodId: food.id,
      customName: null,
      servedQuantity: quantity,
      unit,
      portionId: unit === 'portion' ? portionId : null,
      servedGrams,
      snapKcal: macros.kcal,
      snapFat: macros.fat,
      snapCarb: macros.carb,
      snapProtein: macros.protein,
    },
  };
}

/** Grams for a custom line: resolved when a weight unit + quantity are given, else null. */
function customGrams(quantity: number | undefined, unit: ServingUnit | undefined): number | null {
  if (quantity === undefined || unit === undefined) return null;
  if (unit === 'portion')
    throw new ApiError(422, ErrorCode.ValidationError, { unit: 'portion_needs_food' });
  return resolveServedGrams({ unit, quantity });
}

async function buildCreateData(
  userId: string,
  body: CreateMealEntryRequest,
): Promise<EntryWriteData> {
  if (body.kind === 'referenced') {
    const food = await foodRepo.findById(userId, body.food_id);
    if (!food) throw new ApiError(422, ErrorCode.ValidationError, { food_id: 'unknown_food' });
    return resolveReferenced(food, body.served_quantity, body.unit, body.portion_id ?? null).snap;
  }
  const grams = customGrams(body.served_quantity, body.unit);
  return {
    kind: 'custom',
    foodId: null,
    customName: body.custom_name,
    servedQuantity: body.served_quantity ?? 0,
    unit: body.unit ?? 'g',
    portionId: null,
    servedGrams: grams,
    snapKcal: body.snap.kcal,
    snapFat: body.snap.fat,
    snapCarb: body.snap.carb,
    snapProtein: body.snap.protein,
  };
}

export async function create(
  userId: string,
  mealId: string,
  body: CreateMealEntryRequest,
): Promise<MealEntry | null> {
  if (!(await dayRepo.ownedMeal(userId, mealId))) return null;
  const data = await buildCreateData(userId, body);
  // The UI may target a specific empty row (B-028); otherwise append at the end.
  const orderIndex = body.order_index ?? (await entryRepo.nextOrderIndex(mealId));
  return mealEntryDto(await entryRepo.create(mealId, orderIndex, data));
}

/** Reorder a meal's lines (drag grip, B-029). Returns false → 404 when the meal is not
 *  the user's or any id is not one of its entries. */
export async function reorder(
  userId: string,
  mealId: string,
  body: ReorderEntriesRequest,
): Promise<boolean> {
  if (!(await dayRepo.ownedMeal(userId, mealId))) return false;
  return entryRepo.reorder(
    mealId,
    body.order.map((o) => ({ id: o.id, orderIndex: o.order_index })),
  );
}

/** Move a line to another meal of the same day (B-187/B-188). Only meal_id + order_index
 *  change — the frozen snapshot is untouched. Null → 404 (entry or target not owned). */
export async function move(
  userId: string,
  entryId: string,
  body: MoveEntryRequest,
): Promise<MealEntry | null> {
  const entry = await entryRepo.ownedEntry(userId, entryId);
  if (!entry) return null;
  const target = await dayRepo.ownedMeal(userId, body.target_meal_id);
  if (!target) return null;
  if (target.id === entry.mealId) return mealEntryDto(entry); // no-op (same meal)
  const source = await dayRepo.ownedMeal(userId, entry.mealId);
  if (!source || source.dayLogId !== target.dayLogId)
    throw new ApiError(422, ErrorCode.ValidationError, { target_meal_id: 'different_day' });
  if (await leftoverRepo.isEntryLinked(entryId))
    throw new ApiError(422, ErrorCode.ValidationError, { entry_id: 'entry_in_leftover_group' });
  const orderIndex = body.order_index ?? (await entryRepo.nextOrderIndex(target.id));
  return mealEntryDto(await entryRepo.move(entryId, target.id, orderIndex));
}

/** Rebuild a custom line's snapshot from its merged fields. */
function buildCustomUpdate(existing: MealEntryModel, body: UpdateMealEntryRequest): EntryWriteData {
  const quantity = body.served_quantity ?? num(existing.servedQuantity);
  const unit = (body.unit ?? existing.unit) as ServingUnit;
  const snap = body.snap;
  return {
    kind: 'custom',
    foodId: null,
    customName: body.custom_name ?? existing.customName,
    servedQuantity: quantity,
    unit,
    portionId: null,
    servedGrams: customGrams(quantity, unit),
    snapKcal: snap?.kcal ?? num(existing.snapKcal),
    snapFat: snap?.fat ?? num(existing.snapFat),
    snapCarb: snap?.carb ?? num(existing.snapCarb),
    snapProtein: snap?.protein ?? num(existing.snapProtein),
  };
}

/** Rebuild the full snapshot from the merged fields (resets snapshot at edit time). */
async function buildUpdateData(
  userId: string,
  existing: MealEntryModel,
  body: UpdateMealEntryRequest,
): Promise<EntryWriteData> {
  if (existing.kind !== 'referenced') return buildCustomUpdate(existing, body);
  const quantity = body.served_quantity ?? num(existing.servedQuantity);
  const unit = (body.unit ?? existing.unit) as ServingUnit;
  const foodId = body.food_id ?? existing.foodId!;
  const food = await foodRepo.findById(userId, foodId);
  if (!food) throw new ApiError(422, ErrorCode.ValidationError, { food_id: 'unknown_food' });
  const portionId = body.portion_id !== undefined ? body.portion_id : existing.portionId;
  return resolveReferenced(food, quantity, unit, portionId).snap;
}

export async function update(
  userId: string,
  entryId: string,
  body: UpdateMealEntryRequest,
): Promise<MealEntry | null> {
  const existing = await entryRepo.ownedEntry(userId, entryId);
  if (!existing) return null;
  const data = await buildUpdateData(userId, existing, body);
  const updated = await entryRepo.update(entryId, data);
  // The line drives the pin (GM-2/B-093): if the user changed a pinned line's unit, re-sync
  // the stored pantry unit + cascade to today/future qty-0 placeholders.
  const unitChanged = body.unit !== undefined || body.portion_id !== undefined;
  if (unitChanged && data.kind === 'referenced' && data.foodId) {
    const meal = await dayRepo.ownedMeal(userId, existing.mealId);
    if (meal) {
      await syncUnitFromPinnedEntry(userId, meal.slotName, data.foodId, {
        unit: data.unit,
        portionId: data.portionId,
      });
    }
  }
  return mealEntryDto(updated);
}

export function remove(userId: string, entryId: string): Promise<boolean> {
  return entryRepo.delete(userId, entryId);
}
