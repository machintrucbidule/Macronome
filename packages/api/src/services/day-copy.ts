import type { DayDetail } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { Prisma } from '@prisma/client';
import { dayReadRepo, type DayAggregate } from '../data/repositories/day-read.repo.js';
import {
  dayCopyRepo,
  type CopyMealData,
  type CopyPlan,
} from '../data/repositories/day-copy.repo.js';
import { autoVerdict, type ResolvedSnapshot } from '../domain/day-verdict/index.js';
import { ApiError } from '../http/errors.js';
import { computeDayTotals } from './day-assembler.js';
import { isPast, resolveSnapshotForDate } from './day-context.js';
import { get } from './days.js';

// "Copy a day into another" service (CP-1 / B-082). Orchestration: read the source
// aggregate, refuse an empty source (409 copy_source_empty), resolve the TARGET day's own
// snapshot (frozen if past, live otherwise — like convertToSummary), build the copy plan,
// then delegate the transactional rebuild to dayCopyRepo. The copy is faithful: it does NOT
// re-apply the garde-manger (user decision) and keeps the target's comment/activity_level.
// All figures are server-side (CLAUDE.md rule 2).

const num = (d: { toString(): string }): number => Number(d.toString());
const asJson = (s: ResolvedSnapshot): Prisma.InputJsonValue =>
  s as unknown as Prisma.InputJsonValue;

/** Whether the source day carries something worth copying (a served line or a summary kcal). */
function hasContent(source: DayAggregate): boolean {
  if (source.dayLog.kind === 'summary') {
    return source.dayLog.summaryKcal !== null && num(source.dayLog.summaryKcal) > 0;
  }
  return source.meals.some((m) => m.entries.some((e) => num(e.servedQuantity) > 0));
}

/** Map the source aggregate's meals → the copy plan's meals (entries + leftover groups,
 *  remapping each group's source entry ids to positional indexes the repo can rewire). */
function planMeals(source: DayAggregate): CopyMealData[] {
  return source.meals.map(({ meal, entries, groups }) => {
    const indexById = new Map(entries.map((e, i) => [e.id, i]));
    return {
      slotName: meal.slotName,
      orderIndex: meal.orderIndex,
      entries: entries.map((e) => ({
        kind: e.kind,
        foodId: e.foodId,
        customName: e.customName,
        servedQuantity: num(e.servedQuantity),
        unit: e.unit,
        portionId: e.portionId,
        servedGrams: e.servedGrams === null ? null : num(e.servedGrams),
        snapKcal: num(e.snapKcal),
        snapFat: num(e.snapFat),
        snapCarb: num(e.snapCarb),
        snapProtein: num(e.snapProtein),
        orderIndex: e.orderIndex,
        pinned: e.pinned, // preserve the per-line garde-manger flag (B-198); pantry_item untouched
      })),
      groups: groups.map(({ group, entryIds }) => ({
        containerName: group.containerName,
        tareG: num(group.tareG),
        grossGrams: num(group.grossGrams),
        entryIndexes: entryIds.map((id) => indexById.get(id) ?? -1),
      })),
    };
  });
}

/** POST /days/:date/copy-from — replace the target day with a faithful copy of `from`
 *  (CP-1 / B-082). Source must differ from the target (caller-checked). An empty source
 *  → 409 copy_source_empty (nothing written). A summary source makes the target summary
 *  with the same summary_kcal; a detailed source copies meals/entries/leftovers verbatim.
 *  verdict_auto is recomputed against the target's snapshot; verdict_override is reset. */
export async function copyFromDay(
  userId: string,
  targetDate: string,
  from: string,
): Promise<DayDetail> {
  const source = await dayReadRepo.readAggregate(userId, from);
  if (!source || !hasContent(source)) {
    throw new ApiError(409, ErrorCode.CopySourceEmpty);
  }

  // The target keeps its own snapshot: frozen when the target day is past, live otherwise.
  const snapshot = await resolveTargetSnapshot(userId, targetDate);

  let plan: CopyPlan;
  if (source.dayLog.kind === 'summary') {
    const summaryKcal = num(source.dayLog.summaryKcal ?? 0);
    plan = {
      kind: 'summary',
      summaryKcal,
      verdictAuto: autoVerdict(summaryKcal, snapshot.cal_min, snapshot.cal_max),
      targetSnapshot: asJson(snapshot),
      meals: [],
    };
  } else {
    const kcal = computeDayTotals(source).kcal;
    plan = {
      kind: 'detailed',
      summaryKcal: null,
      verdictAuto: autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max),
      targetSnapshot: asJson(snapshot),
      meals: planMeals(source),
    };
  }

  await dayCopyRepo.copyInto(userId, targetDate, plan);
  return get(userId, targetDate);
}

/** Resolve the target day's snapshot: its frozen one when past + already logged, else live. */
async function resolveTargetSnapshot(userId: string, date: string): Promise<ResolvedSnapshot> {
  if (isPast(date)) {
    const existing = await dayReadRepo.readAggregate(userId, date);
    if (existing) return existing.dayLog.targetSnapshot as unknown as ResolvedSnapshot;
  }
  return resolveSnapshotForDate(userId, date);
}
