import type { MealEntry as MealEntryDto } from '@macronome/shared';
import type { PantryItem as PantryItemModel } from '@prisma/client';
import { mealTemplateRepo } from '../data/repositories/mealTemplate.repo.js';
import { pantryRepo } from '../data/repositories/pantry.repo.js';
import type { PrefillEntry } from '../data/repositories/day.repo.js';
import { DEFAULT_MEAL_SLOTS } from './defaults.js';

// New-day seeding (spec/api §Day): meals come from the user's meal_slot_template (falling
// back to the default slots until one is seeded), and each slot is pre-filled with its
// garde-manger foods at quantity 0 (pantry_item; OPEN_GAPS #8). Archived foods are kept as
// pins but not pre-filled (pantryRepo.listActiveForPrefill). One read of both lists, shared
// by the GET scaffold (preview entries) and POST materialize (persisted lines).

export interface DaySeed {
  /** Ordered slot names + the active pantry foods to pre-fill in each. */
  slots: { name: string; pantry: PantryItemModel[] }[];
}

/** Resolve the user's day structure + pantry pre-fill grouped by slot. */
export async function loadDaySeed(userId: string): Promise<DaySeed> {
  const [template, pantry] = await Promise.all([
    mealTemplateRepo.list(userId),
    pantryRepo.listActiveForPrefill(userId),
  ]);
  const names = template.length > 0 ? template.map((t) => t.name) : DEFAULT_MEAL_SLOTS;
  const bySlot = new Map<string, PantryItemModel[]>();
  for (const item of pantry) {
    const list = bySlot.get(item.mealSlotName);
    if (list) list.push(item);
    else bySlot.set(item.mealSlotName, [item]);
  }
  return { slots: names.map((name) => ({ name, pantry: bySlot.get(name) ?? [] })) };
}

/** Meal-create payloads (slots + qty-0 prefill entries) for dayRepo.createDay. */
export function seedToMeals(
  seed: DaySeed,
): { slotName: string; orderIndex: number; prefill: PrefillEntry[] }[] {
  return seed.slots.map((slot, orderIndex) => ({
    slotName: slot.name,
    orderIndex,
    prefill: slot.pantry.map((p, idx) => ({ foodId: p.foodId, orderIndex: idx })),
  }));
}

/** An unsaved qty-0 preview entry for the GET scaffold (no DB row yet; id ''). */
function previewEntry(item: PantryItemModel, orderIndex: number): MealEntryDto {
  const zero = { kcal: 0, fat: 0, carb: 0, protein: 0 };
  return {
    id: '',
    kind: 'referenced',
    food_id: item.foodId,
    custom_name: null,
    served_quantity: 0,
    unit: 'g',
    portion_id: null,
    served_grams: 0,
    snap: zero,
    consumed: { grams: 0, quantity: 0, ...zero },
    is_pinned: true,
    order_index: orderIndex,
  };
}

/** Preview entries for one slot in the GET scaffold (pantry foods at qty 0). */
export function seedSlotPreview(slot: DaySeed['slots'][number]): MealEntryDto[] {
  return slot.pantry.map((item, idx) => previewEntry(item, idx));
}
