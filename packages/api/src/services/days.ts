import type { DayDetail, PatchDayRequest } from '@macronome/shared';
import { DEFAULT_ACTIVITY_LEVEL, ErrorCode } from '@macronome/shared';
import type { Prisma } from '@prisma/client';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import { dayRepo } from '../data/repositories/day.repo.js';
import { pantryRepo } from '../data/repositories/pantry.repo.js';
import { autoVerdict, type ResolvedSnapshot } from '../domain/day-verdict/index.js';
import { ApiError } from '../http/errors.js';
import { assembleDayDetail, buildConstat, pinKey } from './day-assembler.js';
import { isPast, loadDayContext, resolveSnapshotForDate, type DayContext } from './day-context.js';
import { loadDaySeed, seedSlotPreview, seedToMeals, type DaySeed } from './day-prefill.js';

// Days service (spec/api/days-meals-leftover.md §Day). Orchestration: lazy read/scaffold,
// materialize-on-write, and day-level patch. Snapshot freezing (OPEN_GAPS #1): a past
// day uses its stored snapshot; today recomputes live and re-persists so the value frozen
// at roll-over reflects the latest target/weight. Verdicts are computed on read (the
// source of truth); the persisted verdict_auto is a Stats cache, refreshed on each day read.
// New days are structured from the user's meal_slot_template + garde-manger prefill
// (day-prefill.ts), falling back to the default slots until a template is seeded.

const asJson = (s: ResolvedSnapshot): Prisma.InputJsonValue =>
  s as unknown as Prisma.InputJsonValue;

/** Unsaved scaffold for a never-touched date (200; nothing written). */
function scaffold(
  date: string,
  snapshot: ResolvedSnapshot,
  ctx: DayContext,
  seed: DaySeed,
): DayDetail {
  const auto = autoVerdict(0, snapshot.cal_min, snapshot.cal_max);
  return {
    date,
    kind: 'detailed',
    activity_level: DEFAULT_ACTIVITY_LEVEL,
    comment: null,
    verdict_auto: auto,
    verdict_override: null,
    effective_verdict: auto,
    target_snapshot: snapshot,
    totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    constat: buildConstat({ ...ctx, activityLevel: DEFAULT_ACTIVITY_LEVEL, dayKcal: 0 }),
    meals: seed.slots.map((slot, order_index) => ({
      id: '',
      slot_name: slot.name,
      order_index,
      entries: seedSlotPreview(slot),
      leftover_groups: [],
      totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    })),
  };
}

/** GET /days/:date — existing day (frozen/live snapshot) or an unsaved scaffold. */
export async function get(userId: string, date: string): Promise<DayDetail> {
  const ctx = await loadDayContext(userId, date);
  const aggregate = await dayReadRepo.readAggregate(userId, date);
  if (!aggregate) {
    const seed = await loadDaySeed(userId);
    return scaffold(date, await resolveSnapshotForDate(userId, date), ctx, seed);
  }

  const past = isPast(date);
  const [snapshot, pins] = await Promise.all([
    past
      ? Promise.resolve(aggregate.dayLog.targetSnapshot as unknown as ResolvedSnapshot)
      : resolveSnapshotForDate(userId, date),
    pantryRepo.list(userId),
  ]);
  const pinnedKeys = new Set(pins.map((p) => pinKey(p.mealSlotName, p.foodId)));
  const detail = assembleDayDetail({
    aggregate,
    snapshot,
    profile: ctx.profile,
    weightKg: ctx.weightKg,
    ageOnDay: ctx.ageOnDay,
    pinnedKeys,
  });

  // While today, re-persist the live snapshot + verdict so they freeze correctly later.
  if (!past) {
    await dayRepo.updateDay(userId, date, {
      targetSnapshot: asJson(snapshot),
      verdictAuto: detail.verdict_auto,
    });
  }
  return detail;
}

/** POST /days/:date — materialize the day_log + seed meals (idempotent). */
export async function materialize(userId: string, date: string): Promise<DayDetail> {
  const existing = await dayRepo.findDay(userId, date);
  if (!existing) {
    const [snapshot, seed] = await Promise.all([
      resolveSnapshotForDate(userId, date),
      loadDaySeed(userId),
    ]);
    await dayRepo.createDay(userId, {
      date,
      kind: 'detailed',
      targetSnapshot: asJson(snapshot),
      verdictAuto: autoVerdict(0, snapshot.cal_min, snapshot.cal_max),
      meals: seedToMeals(seed),
    });
  }
  return get(userId, date);
}

/** PATCH /days/:date — activity / comment / override (+ summary_kcal on summary days). */
export async function patch(
  userId: string,
  date: string,
  body: PatchDayRequest,
): Promise<DayDetail | null> {
  const existing = await dayRepo.findDay(userId, date);
  if (!existing) return null;
  if (existing.kind === 'summary' && body.activity_level !== undefined) {
    throw new ApiError(409, ErrorCode.SummaryDayReadonly);
  }
  await dayRepo.updateDay(userId, date, {
    ...(body.activity_level !== undefined ? { activityLevel: body.activity_level } : {}),
    ...(body.comment !== undefined ? { comment: body.comment } : {}),
    ...(body.verdict_override !== undefined ? { verdictOverride: body.verdict_override } : {}),
    ...(body.summary_kcal !== undefined ? { summaryKcal: body.summary_kcal } : {}),
  });
  return get(userId, date);
}

/** POST /days/:date/clear — empty the day (B-046): drop logged foods + leftovers, keep
 *  the garde-manger lines at qty 0, keep comment + activity, reset the verdict to Auto.
 *  A never-materialized scaffold is a no-op; a summary day is read-only (409). */
export async function clear(userId: string, date: string): Promise<DayDetail | null> {
  const existing = await dayRepo.findDay(userId, date);
  if (!existing) return get(userId, date); // scaffold: already "empty with pins at 0"
  if (existing.kind === 'summary') throw new ApiError(409, ErrorCode.SummaryDayReadonly);

  const [aggregate, pins] = await Promise.all([
    dayReadRepo.readAggregate(userId, date),
    pantryRepo.list(userId),
  ]);
  if (!aggregate) return get(userId, date);
  const pinnedKeys = new Set(pins.map((p) => pinKey(p.mealSlotName, p.foodId)));

  const groupIds: string[] = [];
  const deleteEntryIds: string[] = [];
  const zeroEntryIds: string[] = [];
  for (const { meal, entries, groups } of aggregate.meals) {
    for (const g of groups) groupIds.push(g.group.id);
    for (const e of entries) {
      const pinned =
        e.kind === 'referenced' &&
        e.foodId !== null &&
        pinnedKeys.has(pinKey(meal.slotName, e.foodId));
      (pinned ? zeroEntryIds : deleteEntryIds).push(e.id);
    }
  }
  await dayRepo.clearDay(userId, date, { groupIds, deleteEntryIds, zeroEntryIds });
  return get(userId, date);
}
