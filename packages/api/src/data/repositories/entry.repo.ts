import type { MealEntry as MealEntryModel } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

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

  /** Unpin cascade (B-045): drop every qty-0 referenced line for (slot, food) across all
   *  the user's days. Lines with qty > 0 are kept (they lose only the derived pin icon).
   *  User-scoped via day_log → meal → meal_entry. Returns the number of lines removed. */
  async deleteZeroQtyReferencedLines(
    userId: string,
    slotName: string,
    foodId: string,
  ): Promise<number> {
    const mealIds = await this.userMealIds(userId, slotName);
    if (mealIds.length === 0) return 0;
    const res = await prisma.mealEntry.deleteMany({
      where: { mealId: { in: mealIds }, kind: 'referenced', foodId, servedQuantity: 0 },
    });
    return res.count;
  },

  /** Pin cascade (B-045, Option C): append a qty-0 referenced line for (slot, food) to
   *  every day with date >= today whose slot meal does not already list the food. Past
   *  days are untouched; future uncreated days are covered by prefill at creation. The line
   *  carries the pin's stored prefill unit/portion (GM-2/B-092; quantity & grams stay 0). */
  async addZeroQtyLineToCurrentAndFuture(
    userId: string,
    slotName: string,
    foodId: string,
    today: string,
    prefill: { unit: string; portionId: string | null } = { unit: 'g', portionId: null },
  ): Promise<void> {
    const days = await prisma.dayLog.findMany({
      where: { userId, date: { gte: toDate(today) } },
      select: { id: true },
    });
    if (days.length === 0) return;
    const meals = await prisma.meal.findMany({
      where: { dayLogId: { in: days.map((d) => d.id) }, slotName },
      select: { id: true },
    });
    if (meals.length === 0) return;
    const present = await prisma.mealEntry.findMany({
      where: { mealId: { in: meals.map((m) => m.id) }, kind: 'referenced', foodId },
      select: { mealId: true },
    });
    const haveFood = new Set(present.map((e) => e.mealId));
    const targets = meals.filter((m) => !haveFood.has(m.id));
    if (targets.length === 0) return;
    const maxima = await prisma.mealEntry.groupBy({
      by: ['mealId'],
      where: { mealId: { in: targets.map((m) => m.id) } },
      _max: { orderIndex: true },
    });
    const nextIndex = new Map(maxima.map((g) => [g.mealId, (g._max.orderIndex ?? -1) + 1]));
    await prisma.mealEntry.createMany({
      data: targets.map((m) => ({
        mealId: m.id,
        kind: 'referenced',
        foodId,
        servedQuantity: 0,
        unit: prefill.unit,
        portionId: prefill.portionId,
        servedGrams: 0,
        snapKcal: 0,
        snapFat: 0,
        snapCarb: 0,
        snapProtein: 0,
        orderIndex: nextIndex.get(m.id) ?? 0,
      })),
    });
  },

  /** Unit cascade (GM-2/B-093, B-094): set the prefill unit/portion of every qty-0 referenced
   *  line for (slot, food) on date >= today. Past days and qty>0 lines are untouched (grams
   *  stay 0). Returns the number of lines updated. */
  async updateZeroQtyLineUnitCurrentAndFuture(
    userId: string,
    slotName: string,
    foodId: string,
    today: string,
    prefill: { unit: string; portionId: string | null },
  ): Promise<number> {
    const days = await prisma.dayLog.findMany({
      where: { userId, date: { gte: toDate(today) } },
      select: { id: true },
    });
    if (days.length === 0) return 0;
    const meals = await prisma.meal.findMany({
      where: { dayLogId: { in: days.map((d) => d.id) }, slotName },
      select: { id: true },
    });
    if (meals.length === 0) return 0;
    const res = await prisma.mealEntry.updateMany({
      where: {
        mealId: { in: meals.map((m) => m.id) },
        kind: 'referenced',
        foodId,
        servedQuantity: 0,
      },
      data: { unit: prefill.unit, portionId: prefill.portionId },
    });
    return res.count;
  },

  /** Meal ids for the user with the given slot name (day_log → meal scoping helper). */
  async userMealIds(userId: string, slotName: string): Promise<string[]> {
    const days = await prisma.dayLog.findMany({ where: { userId }, select: { id: true } });
    if (days.length === 0) return [];
    const meals = await prisma.meal.findMany({
      where: { dayLogId: { in: days.map((d) => d.id) }, slotName },
      select: { id: true },
    });
    return meals.map((m) => m.id);
  },

  async delete(userId: string, entryId: string): Promise<boolean> {
    if (!(await this.ownedEntry(userId, entryId))) return false;
    await prisma.mealEntry.delete({ where: { id: entryId } });
    return true;
  },

  /** Atomically set the order_index of the given entries (drag reorder, B-029). The
   *  caller verifies meal ownership; this returns false if any id is not one of the
   *  meal's entries (→ 404). order_index may be sparse (blank rows kept). */
  async reorder(mealId: string, order: { id: string; orderIndex: number }[]): Promise<boolean> {
    const ids = order.map((o) => o.id);
    const owned = await prisma.mealEntry.findMany({
      where: { mealId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) return false;
    await prisma.$transaction(
      order.map((o) =>
        prisma.mealEntry.update({ where: { id: o.id }, data: { orderIndex: o.orderIndex } }),
      ),
    );
    return true;
  },
};
