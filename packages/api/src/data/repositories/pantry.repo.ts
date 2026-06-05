import type { PantryItem as PantryItemModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for `pantry_item` (garde-manger pins). User-scoped (CLAUDE.md rule 3). The
// same row is toggled by the Repas 📌 and edited from Paramètres. Dedup is the UNIQUE
// (user_id, meal_slot_name, food_id); the service maps a duplicate to 409. Prefill reads
// only active (non-archived) foods (spec/schema/indexes.md §Referential cleanup).

export const pantryRepo = {
  /** The user's pins, optionally filtered to one meal slot, in insertion order. */
  list(userId: string, mealSlotName?: string): Promise<PantryItemModel[]> {
    return prisma.pantryItem.findMany({
      where: { userId, ...(mealSlotName ? { mealSlotName } : {}) },
      orderBy: { orderIndex: 'asc' },
    });
  },

  findOwned(userId: string, id: string): Promise<PantryItemModel | null> {
    return prisma.pantryItem.findFirst({ where: { id, userId } });
  },

  findByTriple(
    userId: string,
    mealSlotName: string,
    foodId: string,
  ): Promise<PantryItemModel | null> {
    return prisma.pantryItem.findFirst({ where: { userId, mealSlotName, foodId } });
  },

  async nextOrderIndex(userId: string, mealSlotName: string): Promise<number> {
    const last = await prisma.pantryItem.findFirst({
      where: { userId, mealSlotName },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  create(
    userId: string,
    mealSlotName: string,
    foodId: string,
    orderIndex: number,
  ): Promise<PantryItemModel> {
    return prisma.pantryItem.create({ data: { userId, mealSlotName, foodId, orderIndex } });
  },

  async deleteOwned(userId: string, id: string): Promise<boolean> {
    const result = await prisma.pantryItem.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },

  /** Remove the pin for (slot, food); returns false when there was none (idempotent unpin). */
  async deleteByTriple(userId: string, mealSlotName: string, foodId: string): Promise<boolean> {
    const result = await prisma.pantryItem.deleteMany({ where: { userId, mealSlotName, foodId } });
    return result.count > 0;
  },

  /** Active (non-archived-food) pins for new-day prefill, in slot + insertion order. */
  async listActiveForPrefill(userId: string): Promise<PantryItemModel[]> {
    const items = await prisma.pantryItem.findMany({
      where: { userId },
      orderBy: { orderIndex: 'asc' },
    });
    if (items.length === 0) return [];
    const active = await prisma.food.findMany({
      where: { id: { in: items.map((i) => i.foodId) }, archivedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((f) => f.id));
    return items.filter((i) => activeIds.has(i.foodId));
  },
};
