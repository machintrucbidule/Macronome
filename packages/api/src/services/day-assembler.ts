import type {
  DayConstat,
  DayDetail,
  LeftoverGroup as LeftoverGroupDto,
  MacroSnap,
  Meal as MealDto,
  MealEntry as MealEntryDto,
  MealTotals,
  Verdict,
} from '@macronome/shared';
import { ACTIVITY_MULTIPLIERS, type ActivityLevel, type Sex } from '@macronome/shared';
import type {
  LeftoverGroup as LeftoverGroupModel,
  MealEntry as MealEntryModel,
} from '@prisma/client';
import type { DayAggregate, MealAggregate } from '../data/repositories/day-read.repo.js';
import type { ProfileRow } from '../data/repositories/profile.repo.js';
import type { ResolvedSnapshot } from '../domain/day-verdict/index.js';
import { autoVerdict, effectiveVerdict } from '../domain/day-verdict/index.js';
import { netLeftover, prorateConsumed, scaleMacros } from '../domain/leftover/index.js';
import {
  deficitPerDay,
  estimatedBurn,
  kgPerWeek,
  mifflinStJeor,
} from '../domain/metabolic/index.js';

// Build the DayDetail DTO from a stored day aggregate (spec/api/days-meals-leftover.md).
// Orchestration only: it combines the pure domain functions (leftover proration, verdict,
// metabolic burn) over the repository rows — no maths is reinvented here. Full precision;
// the web rounds (00-conventions.md).

const num = (d: { toString(): string }): number => Number(d.toString());
const ZERO_TOTALS: MealTotals = { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 };

/** Per-entry leftover context: which group it is in (net + servedTotal of that group). */
function leftoverContext(meal: MealAggregate): Map<string, { net: number; servedTotal: number }> {
  const ctx = new Map<string, { net: number; servedTotal: number }>();
  const servedById = new Map(
    meal.entries.map((e) => [e.id, e.servedGrams === null ? null : num(e.servedGrams)]),
  );
  for (const { group, entryIds } of meal.groups) {
    const servedTotal = entryIds.reduce((sum, id) => sum + (servedById.get(id) ?? 0), 0);
    const net = netLeftover(num(group.grossGrams), num(group.tareG));
    for (const id of entryIds) ctx.set(id, { net, servedTotal });
  }
  return ctx;
}

/** Map one entry row to its DTO. `ctx` carries leftover proration for entries in a group
 * (empty for a freshly created/edited entry → consumed = served). */
export function mealEntryDto(
  entry: MealEntryModel,
  ctx: Map<string, { net: number; servedTotal: number }> = new Map(),
): MealEntryDto {
  const servedGrams = entry.servedGrams === null ? null : num(entry.servedGrams);
  const snap: MacroSnap = {
    kcal: num(entry.snapKcal),
    fat: num(entry.snapFat),
    carb: num(entry.snapCarb),
    protein: num(entry.snapProtein),
  };
  const group = ctx.get(entry.id);
  let consumedGrams = servedGrams;
  let consumed: MacroSnap = snap;
  if (group && servedGrams !== null) {
    consumedGrams = prorateConsumed(servedGrams, group.net, group.servedTotal);
    consumed = scaleMacros(snap, consumedGrams, servedGrams);
  }
  return {
    id: entry.id,
    kind: entry.kind as 'referenced' | 'custom',
    food_id: entry.foodId,
    custom_name: entry.customName,
    served_quantity: num(entry.servedQuantity),
    unit: entry.unit as MealEntryDto['unit'],
    portion_id: entry.portionId,
    served_grams: servedGrams,
    snap,
    consumed: { grams: consumedGrams, ...consumed },
    is_pinned: entry.isPinned,
    order_index: entry.orderIndex,
  };
}

function groupDto(group: LeftoverGroupModel, entryIds: string[]): LeftoverGroupDto {
  const tare = num(group.tareG);
  const gross = num(group.grossGrams);
  return {
    id: group.id,
    container_name: group.containerName,
    tare_g: tare,
    gross_grams: gross,
    leftover_net_grams: netLeftover(gross, tare),
    entry_ids: entryIds,
  };
}

function sumTotals(entries: MealEntryDto[]): MealTotals {
  return entries.reduce<MealTotals>(
    (t, e) => ({
      kcal: t.kcal + e.consumed.kcal,
      fat: t.fat + e.consumed.fat,
      carb: t.carb + e.consumed.carb,
      protein: t.protein + e.consumed.protein,
      weight_g: t.weight_g + (e.consumed.grams ?? 0),
    }),
    { ...ZERO_TOTALS },
  );
}

function mealDto(meal: MealAggregate): MealDto {
  const ctx = leftoverContext(meal);
  const entries = meal.entries.map((e) => mealEntryDto(e, ctx));
  return {
    id: meal.meal.id,
    slot_name: meal.meal.slotName,
    order_index: meal.meal.orderIndex,
    entries,
    leftover_groups: meal.groups.map((g) => groupDto(g.group, g.entryIds)),
    totals: sumTotals(entries),
  };
}

function dayTotals(meals: MealTotals[]): MealTotals {
  return meals.reduce<MealTotals>(
    (t, m) => ({
      kcal: t.kcal + m.kcal,
      fat: t.fat + m.fat,
      carb: t.carb + m.carb,
      protein: t.protein + m.protein,
      weight_g: t.weight_g + m.weight_g,
    }),
    { ...ZERO_TOTALS },
  );
}

/** Consumed totals over a detailed day's meals (journal/stats reuse; no constat). */
export function computeDayTotals(aggregate: DayAggregate): MealTotals {
  return dayTotals(aggregate.meals.map(mealDto).map((m) => m.totals));
}

export interface ConstatInput {
  profile: ProfileRow;
  weightKg: number | null;
  ageOnDay: number;
  activityLevel: string | null;
  dayKcal: number;
}

/** Per-day burn/deficit constat (null without the day's weight or activity level). */
export function buildConstat({
  profile,
  weightKg,
  ageOnDay,
  activityLevel,
  dayKcal,
}: ConstatInput): DayConstat {
  if (weightKg === null || activityLevel === null) {
    return { estimated_burn: null, deficit: null, kg_per_week: null };
  }
  const bmr = mifflinStJeor({
    weightKg,
    heightCm: num(profile.heightCm),
    ageYears: ageOnDay,
    sex: profile.sex as Sex,
  });
  const burn = estimatedBurn(bmr, ACTIVITY_MULTIPLIERS[activityLevel as ActivityLevel]);
  const deficit = deficitPerDay(dayKcal, burn);
  return { estimated_burn: burn, deficit, kg_per_week: kgPerWeek(deficit) };
}

export interface AssembleInput {
  aggregate: DayAggregate;
  snapshot: ResolvedSnapshot;
  profile: ProfileRow;
  weightKg: number | null;
  ageOnDay: number;
}

/** Assemble the full DayDetail from a stored aggregate + the (live or frozen) snapshot. */
export function assembleDayDetail({
  aggregate,
  snapshot,
  profile,
  weightKg,
  ageOnDay,
}: AssembleInput): DayDetail {
  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const meals = isSummary ? [] : aggregate.meals.map(mealDto);
  const totals = isSummary ? { ...ZERO_TOTALS } : dayTotals(meals.map((m) => m.totals));
  const summaryKcal = dayLog.summaryKcal === null ? null : num(dayLog.summaryKcal);
  const kcal = isSummary ? (summaryKcal ?? 0) : totals.kcal;
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const override = (dayLog.verdictOverride ?? null) as Verdict | null;
  return {
    date: dayLog.date.toISOString().slice(0, 10),
    kind: dayLog.kind as 'detailed' | 'summary',
    activity_level: dayLog.activityLevel,
    comment: dayLog.comment,
    verdict_auto: auto,
    verdict_override: override,
    effective_verdict: effectiveVerdict(override, auto),
    ...(isSummary ? { summary_kcal: summaryKcal } : {}),
    target_snapshot: snapshot,
    totals: isSummary ? { ...totals, kcal } : totals,
    constat: buildConstat({
      profile,
      weightKg,
      ageOnDay,
      activityLevel: dayLog.activityLevel,
      dayKcal: kcal,
    }),
    meals,
  };
}
