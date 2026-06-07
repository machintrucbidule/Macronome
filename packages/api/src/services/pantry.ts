import type {
  CreatePantryRequest,
  EntryUnit,
  MealEntry,
  PantryItem,
  UpdatePantryRequest,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { PantryItem as PantryItemModel } from '@prisma/client';
import { dayRepo } from '../data/repositories/day.repo.js';
import { entryRepo } from '../data/repositories/entry.repo.js';
import { foodRepo, type FoodWithPortions } from '../data/repositories/food.repo.js';
import { pantryRepo, type PrefillUnit } from '../data/repositories/pantry.repo.js';
import { ApiError } from '../http/errors.js';
import { mealEntryDto } from './day-assembler.js';
import { todayString } from './day-context.js';

// Pantry service (spec/api §Settings + §Meal entries pin/unpin; spec/logic/pantry-pin.md).
// The garde-manger is one live dataset seen from two places: the Paramètres editor
// (POST/DELETE /pantry) and the Repas 📌 toggle (POST /meals/:id/entries/:id/pin · /unpin).
// pantry_item is the single source of truth: the pin icon is derived from it on every read
// (B-045). Pinning runs the add cascade (qty-0 line on today + future days, Option C);
// unpinning runs the delete cascade (drop qty-0 lines, keep qty>0). Dedup is the UNIQUE
// (user, meal_slot_name, food_id): a direct duplicate add → 409 pantry_duplicate; the 📌
// toggle is idempotent.

function toDto(row: PantryItemModel): PantryItem {
  return {
    id: row.id,
    meal_slot_name: row.mealSlotName,
    food_id: row.foodId,
    unit: row.unit as EntryUnit,
    portion_id: row.portionId,
    order_index: row.orderIndex,
  };
}

/** Validate + normalize a prefill unit against a food's named portions (GM-2/B-092). A
 *  'portion' unit must name one of the food's portions (else 422); any other unit drops the
 *  portion id. Mirrors entries.ts:resolveReferenced. */
function resolvePrefillUnit(
  food: FoodWithPortions,
  unit: EntryUnit,
  portionId: string | null,
): PrefillUnit {
  if (unit === 'portion') {
    if (!portionId || !food.portions.some((p) => p.id === portionId)) {
      throw new ApiError(422, ErrorCode.ValidationError, { portion_id: 'invalid_portion' });
    }
    return { unit, portionId };
  }
  return { unit, portionId: null };
}

export async function list(userId: string, mealSlotName?: string): Promise<PantryItem[]> {
  return (await pantryRepo.list(userId, mealSlotName)).map(toDto);
}

export async function create(userId: string, body: CreatePantryRequest): Promise<PantryItem> {
  const food = await foodRepo.findById(userId, body.food_id);
  if (!food) {
    throw new ApiError(422, ErrorCode.ValidationError, { food_id: 'unknown_food' });
  }
  if (await pantryRepo.findByTriple(userId, body.meal_slot_name, body.food_id)) {
    throw new ApiError(409, ErrorCode.PantryDuplicate);
  }
  const prefill = resolvePrefillUnit(food, body.unit ?? 'g', body.portion_id ?? null);
  const orderIndex = await pantryRepo.nextOrderIndex(userId, body.meal_slot_name);
  const item = await pantryRepo.create(
    userId,
    body.meal_slot_name,
    body.food_id,
    orderIndex,
    prefill,
  );
  await entryRepo.addZeroQtyLineToCurrentAndFuture(
    userId,
    body.meal_slot_name,
    body.food_id,
    todayString(),
    prefill,
  );
  return toDto(item);
}

/** Change a pin's prefill unit (GM-2/B-094): validate the portion, persist, then cascade to
 *  today + future qty-0 placeholder lines (past + qty>0 lines untouched). Null if not owned. */
export async function update(
  userId: string,
  id: string,
  body: UpdatePantryRequest,
): Promise<PantryItem | null> {
  const item = await pantryRepo.findOwned(userId, id);
  if (!item) return null;
  const food = await foodRepo.findById(userId, item.foodId);
  if (!food) {
    throw new ApiError(422, ErrorCode.ValidationError, { food_id: 'unknown_food' });
  }
  const prefill = resolvePrefillUnit(food, body.unit, body.portion_id ?? null);
  const updated = await pantryRepo.updateUnit(userId, id, prefill);
  if (!updated) return null;
  await entryRepo.updateZeroQtyLineUnitCurrentAndFuture(
    userId,
    item.mealSlotName,
    item.foodId,
    todayString(),
    prefill,
  );
  return toDto(updated);
}

/** Re-sync a pin's unit from an edited meal line (GM-2/B-093, "the line drives the pin"): if
 *  (slot, food) is pinned, store the line's unit/portion and cascade to today + future qty-0
 *  lines. No-op when the food is not pinned in that slot. */
export async function syncUnitFromPinnedEntry(
  userId: string,
  slotName: string,
  foodId: string,
  prefill: PrefillUnit,
): Promise<void> {
  const item = await pantryRepo.findByTriple(userId, slotName, foodId);
  if (!item) return;
  await pantryRepo.updateUnit(userId, item.id, prefill);
  await entryRepo.updateZeroQtyLineUnitCurrentAndFuture(
    userId,
    slotName,
    foodId,
    todayString(),
    prefill,
  );
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const item = await pantryRepo.findOwned(userId, id);
  if (!item) return false;
  await pantryRepo.deleteOwned(userId, id);
  await entryRepo.deleteZeroQtyReferencedLines(userId, item.mealSlotName, item.foodId);
  return true;
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

/** Pin the entry's food on its slot (idempotent upsert) + run the add cascade (today +
 *  future). The pin icon is derived live, so no per-line flag is written (B-045). */
export async function pin(userId: string, entryId: string): Promise<MealEntry | null> {
  const ctx = await entryPinContext(userId, entryId);
  if (!ctx) return null;
  let item = await pantryRepo.findByTriple(userId, ctx.slotName, ctx.foodId);
  if (!item) {
    // Capture the pinned line's own unit/portion onto the new pin (GM-2/B-093).
    const orderIndex = await pantryRepo.nextOrderIndex(userId, ctx.slotName);
    item = await pantryRepo.create(userId, ctx.slotName, ctx.foodId, orderIndex, {
      unit: ctx.entry.unit,
      portionId: ctx.entry.portionId,
    });
  }
  await entryRepo.addZeroQtyLineToCurrentAndFuture(
    userId,
    ctx.slotName,
    ctx.foodId,
    todayString(),
    {
      unit: item.unit,
      portionId: item.portionId,
    },
  );
  return mealEntryDto(ctx.entry, new Map(), true);
}

/** Unpin the entry's food from its slot + run the delete cascade (drop qty-0 lines on all
 *  days, keep qty>0). The line loses its derived pin icon; no per-line flag is cleared. */
export async function unpin(userId: string, entryId: string): Promise<MealEntry | null> {
  const ctx = await entryPinContext(userId, entryId);
  if (!ctx) return null;
  await pantryRepo.deleteByTriple(userId, ctx.slotName, ctx.foodId);
  await entryRepo.deleteZeroQtyReferencedLines(userId, ctx.slotName, ctx.foodId);
  return mealEntryDto(ctx.entry, new Map(), false);
}
