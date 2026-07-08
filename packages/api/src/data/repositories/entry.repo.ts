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

  /** Re-parent a line to another meal (B-187/B-188). Only meal_id + order_index change —
   *  the frozen macro snapshot is never touched. All guards are the caller's (service). */
  move(entryId: string, mealId: string, orderIndex: number): Promise<MealEntryModel> {
    return prisma.mealEntry.update({ where: { id: entryId }, data: { mealId, orderIndex } });
  },

  /** Set a line's per-line garde-manger flag (B-198). Caller owns the entry. */
  setPinned(entryId: string, pinned: boolean): Promise<MealEntryModel> {
    return prisma.mealEntry.update({ where: { id: entryId }, data: { pinned } });
  },

  /** Count the garde-manger (pinned) referenced lines for a food in one meal (B-198 reference
   *  count): the food stays pinned while ≥1 remains in the acting meal. */
  countPinnedInMeal(mealId: string, foodId: string): Promise<number> {
    return prisma.mealEntry.count({
      where: { mealId, kind: 'referenced', foodId, pinned: true },
    });
  },

  /** Unpin wipe — delete every qty-0 **pinned** referenced line for (slot, food) across all
   *  the user's days (the garde-manger placeholders). Normal qty-0 duplicates (pinned=false)
   *  are left untouched (B-198). User-scoped. Returns the number of lines removed. */
  async deleteZeroQtyReferencedLines(
    userId: string,
    slotName: string,
    foodId: string,
  ): Promise<number> {
    const mealIds = await this.userMealIds(userId, slotName);
    if (mealIds.length === 0) return 0;
    const res = await prisma.mealEntry.deleteMany({
      where: {
        mealId: { in: mealIds },
        kind: 'referenced',
        foodId,
        servedQuantity: 0,
        pinned: true,
      },
    });
    return res.count;
  },

  /** Unpin wipe — clear the garde-manger flag on qty>0 lines for (slot, food) across the
   *  user's days, so a real logged line stays but reads as a normal line (B-198). */
  async clearPinnedFlagQtyPositive(
    userId: string,
    slotName: string,
    foodId: string,
  ): Promise<number> {
    const mealIds = await this.userMealIds(userId, slotName);
    if (mealIds.length === 0) return 0;
    const res = await prisma.mealEntry.updateMany({
      where: {
        mealId: { in: mealIds },
        kind: 'referenced',
        foodId,
        servedQuantity: { gt: 0 },
        pinned: true,
      },
      data: { pinned: false },
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
    // Dedup on a PINNED line for F (B-198): a day that lists F only as a normal (unpinned)
    // duplicate still gets its own garde-manger placeholder.
    const present = await prisma.mealEntry.findMany({
      where: { mealId: { in: meals.map((m) => m.id) }, kind: 'referenced', foodId, pinned: true },
      select: { mealId: true },
    });
    const havePinnedFood = new Set(present.map((e) => e.mealId));
    const targets = meals.filter((m) => !havePinnedFood.has(m.id));
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
        pinned: true, // a prefill placeholder is a garde-manger line (B-198)
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
        pinned: true, // only garde-manger placeholders re-unit (B-198), not normal qty-0 lines
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
