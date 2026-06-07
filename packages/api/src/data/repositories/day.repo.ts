import type { DayLog as DayLogModel, Meal as MealModel, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

// Writes for the day aggregate root: day_log (lazy create + day-level patch) and its
// meals (per-day structure, never the template). Reads live in day-read.repo.ts; the
// 300-line rule (modularity.md §1) splits the aggregate across read/write/entry/leftover
// files. Every method is user-scoped (CLAUDE.md rule 3) — sub-entity ownership is
// verified by walking meal → day_log.user_id (the schema has no Prisma relations).

/** A garde-manger pre-fill line materialized with a new day (qty 0; pin derived live). */
export interface PrefillEntry {
  foodId: string;
  orderIndex: number;
}

export interface CreateDayData {
  date: string;
  kind: 'detailed' | 'summary';
  summaryKcal?: number | null;
  verdictAuto?: 'OK' | 'NOK' | null;
  targetSnapshot: Prisma.InputJsonValue;
  meals: { slotName: string; orderIndex: number; prefill?: PrefillEntry[] }[];
}

export interface UpdateDayData {
  activityLevel?: string;
  comment?: string | null;
  verdictOverride?: 'OK' | 'NOK' | null;
  verdictAuto?: 'OK' | 'NOK' | null;
  summaryKcal?: number | null;
  targetSnapshot?: Prisma.InputJsonValue;
}

export const dayRepo = {
  findDay(userId: string, date: string): Promise<DayLogModel | null> {
    return prisma.dayLog.findFirst({ where: { userId, date: toDate(date) } });
  },

  /** Materialize a day_log + seed its meals in one transaction. */
  createDay(userId: string, data: CreateDayData): Promise<DayLogModel> {
    return prisma.$transaction(async (tx) => {
      const day = await tx.dayLog.create({
        data: {
          userId,
          date: toDate(data.date),
          kind: data.kind,
          summaryKcal: data.summaryKcal ?? null,
          verdictAuto: data.verdictAuto ?? null,
          targetSnapshot: data.targetSnapshot,
        },
      });
      for (const m of data.meals) {
        const meal = await tx.meal.create({
          data: { dayLogId: day.id, slotName: m.slotName, orderIndex: m.orderIndex },
        });
        if (m.prefill && m.prefill.length > 0) {
          // Garde-manger pre-fill: qty-0 referenced lines, snapshot 0 (the user edits the
          // quantity to log). The pin icon is derived live from pantry_item on read, not
          // stored per line (spec/logic/pantry-pin.md, B-045).
          await tx.mealEntry.createMany({
            data: m.prefill.map((p) => ({
              mealId: meal.id,
              kind: 'referenced',
              foodId: p.foodId,
              servedQuantity: 0,
              unit: 'g',
              servedGrams: 0,
              snapKcal: 0,
              snapFat: 0,
              snapCarb: 0,
              snapProtein: 0,
              orderIndex: p.orderIndex,
            })),
          });
        }
      }
      return day;
    });
  },

  /** Patch day-level fields (scoped). Returns the updated row, or null if not owned. */
  async updateDay(userId: string, date: string, data: UpdateDayData): Promise<DayLogModel | null> {
    const result = await prisma.dayLog.updateMany({
      where: { userId, date: toDate(date) },
      data: {
        ...(data.activityLevel !== undefined ? { activityLevel: data.activityLevel } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
        ...(data.verdictOverride !== undefined ? { verdictOverride: data.verdictOverride } : {}),
        ...(data.verdictAuto !== undefined ? { verdictAuto: data.verdictAuto } : {}),
        ...(data.summaryKcal !== undefined ? { summaryKcal: data.summaryKcal } : {}),
        ...(data.targetSnapshot !== undefined ? { targetSnapshot: data.targetSnapshot } : {}),
      },
    });
    return result.count > 0 ? this.findDay(userId, date) : null;
  },

  /** Convert a detailed day to a summary (light) day in one transaction (day-model, §9):
   *  drop its meals (entries/leftovers cascade) and set kind='summary' + summary_kcal +
   *  verdict_auto. Caller guarantees the day has no calorie lines (Σ = 0). User-scoped. */
  async convertToSummary(
    userId: string,
    date: string,
    data: { summaryKcal: number; verdictAuto: 'OK' | 'NOK' | null },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const day = await tx.dayLog.findFirst({
        where: { userId, date: toDate(date) },
        select: { id: true },
      });
      if (!day) return;
      await tx.meal.deleteMany({ where: { dayLogId: day.id } });
      await tx.dayLog.updateMany({
        where: { userId, date: toDate(date) },
        data: { kind: 'summary', summaryKcal: data.summaryKcal, verdictAuto: data.verdictAuto },
      });
    });
  },

  /** The meal if it belongs to the user (walks meal → day_log.user_id), else null. */
  async ownedMeal(userId: string, mealId: string): Promise<MealModel | null> {
    const meal = await prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) return null;
    const day = await prisma.dayLog.findFirst({
      where: { id: meal.dayLogId, userId },
      select: { id: true },
    });
    return day ? meal : null;
  },

  createMeal(dayLogId: string, slotName: string, orderIndex: number): Promise<MealModel> {
    return prisma.meal.create({ data: { dayLogId, slotName, orderIndex } });
  },

  async updateMeal(
    userId: string,
    mealId: string,
    data: { slotName?: string; orderIndex?: number },
  ): Promise<MealModel | null> {
    if (!(await this.ownedMeal(userId, mealId))) return null;
    return prisma.meal.update({
      where: { id: mealId },
      data: {
        ...(data.slotName !== undefined ? { slotName: data.slotName } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: data.orderIndex } : {}),
      },
    });
  },

  async deleteMeal(userId: string, mealId: string): Promise<boolean> {
    if (!(await this.ownedMeal(userId, mealId))) return false;
    await prisma.meal.delete({ where: { id: mealId } });
    return true;
  },

  /** Clear-the-day (B-046): in one transaction drop the day's leftover groups (links
   *  cascade), delete the non-pinned entries, reset the pinned (garde-manger) lines to
   *  qty 0, and clear `verdict_override` (back to Auto). The caller (service) resolves
   *  which ids fall in each bucket from the user-scoped aggregate + live pantry pins. */
  async clearDay(
    userId: string,
    date: string,
    ids: { groupIds: string[]; deleteEntryIds: string[]; zeroEntryIds: string[] },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      if (ids.groupIds.length > 0) {
        await tx.leftoverGroup.deleteMany({ where: { id: { in: ids.groupIds } } });
      }
      if (ids.deleteEntryIds.length > 0) {
        await tx.mealEntry.deleteMany({ where: { id: { in: ids.deleteEntryIds } } });
      }
      if (ids.zeroEntryIds.length > 0) {
        await tx.mealEntry.updateMany({
          where: { id: { in: ids.zeroEntryIds } },
          data: {
            servedQuantity: 0,
            unit: 'g',
            portionId: null,
            servedGrams: 0,
            snapKcal: 0,
            snapFat: 0,
            snapCarb: 0,
            snapProtein: 0,
          },
        });
      }
      await tx.dayLog.updateMany({
        where: { userId, date: toDate(date) },
        data: { verdictOverride: null },
      });
    });
  },
};
