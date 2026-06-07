import type { DayLog as DayLogModel, Meal as MealModel, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

// Writes for the day aggregate root: day_log (lazy create + day-level patch) and its
// meals (per-day structure, never the template). Reads live in day-read.repo.ts; the
// 300-line rule (modularity.md §1) splits the aggregate across read/write/entry/leftover
// files. Every method is user-scoped (CLAUDE.md rule 3) — sub-entity ownership is
// verified by walking meal → day_log.user_id (the schema has no Prisma relations).

/** A garde-manger pre-fill line materialized with a new day (qty 0; pin derived live). The
 *  unit/portionId come from the pin's stored prefill unit (GM-2/B-092). */
export interface PrefillEntry {
  foodId: string;
  orderIndex: number;
  unit: string;
  portionId: string | null;
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

type MealSeed = { slotName: string; orderIndex: number; prefill?: PrefillEntry[] };

/** Create a day's meals + their qty-0 garde-manger pre-fill lines inside a transaction.
 *  Shared by createDay (materialize) and convertToDetailed (summary→detailed, day-model §9).
 *  Pre-fill lines are qty-0 referenced lines with a 0 snapshot (the user edits the quantity);
 *  the pin icon is derived live from pantry_item on read, not stored (pantry-pin.md, B-045). */
async function seedMealsTx(
  tx: Prisma.TransactionClient,
  dayLogId: string,
  meals: MealSeed[],
): Promise<void> {
  for (const m of meals) {
    const meal = await tx.meal.create({
      data: { dayLogId, slotName: m.slotName, orderIndex: m.orderIndex },
    });
    if (m.prefill && m.prefill.length > 0) {
      await tx.mealEntry.createMany({
        data: m.prefill.map((p) => ({
          mealId: meal.id,
          kind: 'referenced',
          foodId: p.foodId,
          servedQuantity: 0,
          unit: p.unit,
          portionId: p.portionId,
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
      await seedMealsTx(tx, day.id, data.meals);
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

  /** Convert a summary day to a detailed day in one transaction (day-model §9): clear
   *  summary_kcal, set kind='detailed' + verdict_auto, and seed meals from the template +
   *  garde-manger pre-fill. User-scoped; no-op when the day is missing. */
  async convertToDetailed(
    userId: string,
    date: string,
    data: { verdictAuto: 'OK' | 'NOK' | null; meals: MealSeed[] },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const day = await tx.dayLog.findFirst({
        where: { userId, date: toDate(date) },
        select: { id: true },
      });
      if (!day) return;
      await tx.dayLog.updateMany({
        where: { userId, date: toDate(date) },
        data: { kind: 'detailed', summaryKcal: null, verdictAuto: data.verdictAuto },
      });
      await seedMealsTx(tx, day.id, data.meals);
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
   *  qty 0 — restoring each pin's stored prefill unit/portion (GM-2/B-092), not forcing g —
   *  and clear `verdict_override` (back to Auto). The caller (service) resolves which ids fall
   *  in each bucket from the user-scoped aggregate + live pantry pins. */
  async clearDay(
    userId: string,
    date: string,
    ids: {
      groupIds: string[];
      deleteEntryIds: string[];
      zeroEntries: { id: string; unit: string; portionId: string | null }[];
    },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      if (ids.groupIds.length > 0) {
        await tx.leftoverGroup.deleteMany({ where: { id: { in: ids.groupIds } } });
      }
      if (ids.deleteEntryIds.length > 0) {
        await tx.mealEntry.deleteMany({ where: { id: { in: ids.deleteEntryIds } } });
      }
      // Group the reset by (unit, portionId) so one updateMany handles each prefill unit.
      const byUnit = new Map<string, { unit: string; portionId: string | null; ids: string[] }>();
      for (const e of ids.zeroEntries) {
        const key = `${e.unit}|${e.portionId ?? ''}`;
        const bucket = byUnit.get(key) ?? { unit: e.unit, portionId: e.portionId, ids: [] };
        bucket.ids.push(e.id);
        byUnit.set(key, bucket);
      }
      for (const { unit, portionId, ids: entryIds } of byUnit.values()) {
        await tx.mealEntry.updateMany({
          where: { id: { in: entryIds } },
          data: {
            servedQuantity: 0,
            unit,
            portionId,
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
