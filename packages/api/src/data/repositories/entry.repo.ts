import type { MealEntry as MealEntryModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Writes for meal_entry (a logged food line). Part of the day aggregate; split out for
// the 300-line rule. User-scoped via meal → day_log.user_id (no Prisma relations). The
// served_grams + macro snapshot are resolved by the service (domain/serving) and passed
// in already frozen; this layer only persists.

export interface EntryWriteData {
  kind: 'referenced' | 'custom';
  foodId: string | null;
  customName: string | null;
  servedQuantity: number;
  unit: string;
  portionId: string | null;
  servedGrams: number | null;
  snapKcal: number;
  snapFat: number;
  snapCarb: number;
  snapProtein: number;
}

export const entryRepo = {
  /** The entry if it belongs to the user (entry → meal → day_log.user_id), else null. */
  async ownedEntry(userId: string, entryId: string): Promise<MealEntryModel | null> {
    const entry = await prisma.mealEntry.findUnique({ where: { id: entryId } });
    if (!entry) return null;
    const meal = await prisma.meal.findUnique({
      where: { id: entry.mealId },
      select: { dayLogId: true },
    });
    if (!meal) return null;
    const day = await prisma.dayLog.findFirst({
      where: { id: meal.dayLogId, userId },
      select: { id: true },
    });
    return day ? entry : null;
  },

  /** Entries of a meal whose ids are in `ids` (used to total a leftover selection). */
  entriesByIds(mealId: string, ids: string[]): Promise<MealEntryModel[]> {
    return prisma.mealEntry.findMany({ where: { mealId, id: { in: ids } } });
  },

  /** Next order_index for a meal (append at the end). */
  async nextOrderIndex(mealId: string): Promise<number> {
    const last = await prisma.mealEntry.findFirst({
      where: { mealId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  create(mealId: string, orderIndex: number, data: EntryWriteData): Promise<MealEntryModel> {
    return prisma.mealEntry.create({ data: { mealId, orderIndex, ...data } });
  },

  update(entryId: string, data: EntryWriteData): Promise<MealEntryModel> {
    return prisma.mealEntry.update({ where: { id: entryId }, data });
  },

  /** Toggle the pin flag (mirrors a pantry_item). Used by the Repas 📌 (M7). */
  setPinned(entryId: string, isPinned: boolean): Promise<MealEntryModel> {
    return prisma.mealEntry.update({ where: { id: entryId }, data: { isPinned } });
  },

  async delete(userId: string, entryId: string): Promise<boolean> {
    if (!(await this.ownedEntry(userId, entryId))) return false;
    await prisma.mealEntry.delete({ where: { id: entryId } });
    return true;
  },
};
