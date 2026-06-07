import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

// Write side of "copy a day into another" (CP-1 / B-082). One transaction rebuilds the
// target day from a plan the service derived from the source aggregate: it upserts the
// target day_log, drops its current meals (entries/leftovers cascade), and recreates the
// source's meals → entries → leftover groups. The garde-manger is NOT re-applied — a copy
// is a faithful reproduction of the source (user decision). User-scoped (CLAUDE.md rule 3).
// Reads/other writes stay in day-read.repo / day.repo (the 300-line split, modularity §1).

/** A copied food line (frozen macro snapshot carried verbatim from the source). */
export interface CopyEntryData {
  kind: string;
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
  orderIndex: number;
}

/** A copied leftover group; `entryIndexes` reference positions in the meal's `entries`. */
export interface CopyGroupData {
  containerName: string;
  tareG: number;
  grossGrams: number;
  entryIndexes: number[];
}

export interface CopyMealData {
  slotName: string;
  orderIndex: number;
  entries: CopyEntryData[];
  groups: CopyGroupData[];
}

export interface CopyPlan {
  kind: 'detailed' | 'summary';
  summaryKcal: number | null;
  verdictAuto: 'OK' | 'NOK' | null;
  /** The TARGET day's own resolved snapshot (frozen if past, live otherwise). */
  targetSnapshot: Prisma.InputJsonValue;
  meals: CopyMealData[];
}

export const dayCopyRepo = {
  /** Replace the target day with the plan in one transaction. Keeps the target's own
   *  comment/activity_level; resets verdict_override to null. */
  async copyInto(userId: string, targetDate: string, plan: CopyPlan): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.dayLog.findFirst({
        where: { userId, date: toDate(targetDate) },
        select: { id: true },
      });
      let dayLogId: string;
      if (!existing) {
        const created = await tx.dayLog.create({
          data: {
            userId,
            date: toDate(targetDate),
            kind: plan.kind,
            summaryKcal: plan.summaryKcal,
            verdictAuto: plan.verdictAuto,
            targetSnapshot: plan.targetSnapshot,
          },
          select: { id: true },
        });
        dayLogId = created.id;
      } else {
        dayLogId = existing.id;
        await tx.meal.deleteMany({ where: { dayLogId } });
        await tx.dayLog.updateMany({
          where: { userId, date: toDate(targetDate) },
          data: {
            kind: plan.kind,
            summaryKcal: plan.summaryKcal,
            verdictAuto: plan.verdictAuto,
            verdictOverride: null,
          },
        });
      }

      for (const m of plan.meals) {
        const meal = await tx.meal.create({
          data: { dayLogId, slotName: m.slotName, orderIndex: m.orderIndex },
        });
        const entryIds: string[] = [];
        for (const e of m.entries) {
          const entry = await tx.mealEntry.create({
            data: {
              mealId: meal.id,
              kind: e.kind,
              foodId: e.foodId,
              customName: e.customName,
              servedQuantity: e.servedQuantity,
              unit: e.unit,
              portionId: e.portionId,
              servedGrams: e.servedGrams,
              snapKcal: e.snapKcal,
              snapFat: e.snapFat,
              snapCarb: e.snapCarb,
              snapProtein: e.snapProtein,
              orderIndex: e.orderIndex,
            },
          });
          entryIds.push(entry.id);
        }
        for (const g of m.groups) {
          const group = await tx.leftoverGroup.create({
            data: {
              mealId: meal.id,
              containerName: g.containerName,
              tareG: g.tareG,
              grossGrams: g.grossGrams,
            },
          });
          const links = g.entryIndexes
            .map((i) => entryIds[i])
            .filter((id): id is string => id !== undefined)
            .map((mealEntryId) => ({ leftoverGroupId: group.id, mealEntryId }));
          if (links.length > 0) {
            await tx.leftoverGroupEntry.createMany({ data: links });
          }
        }
      }
    });
  },
};
