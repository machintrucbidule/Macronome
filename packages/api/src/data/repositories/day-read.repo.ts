import type {
  DayLog as DayLogModel,
  LeftoverGroup as LeftoverGroupModel,
  Meal as MealModel,
  MealEntry as MealEntryModel,
} from '@prisma/client';
import { prisma } from '../prisma.js';

// Aggregate READ for the day sheet (day_log → meal → meal_entry → leftover_group →
// leftover_group_entry). The schema has no Prisma relations (column-faithful for the
// check:schema gate), so each level is fetched explicitly and stitched in code — the
// same pattern as food.repo. User-scoped (CLAUDE.md rule 3). No business logic here:
// the service prorates and totals from these rows.

export interface MealAggregate {
  meal: MealModel;
  entries: MealEntryModel[];
  groups: { group: LeftoverGroupModel; entryIds: string[] }[];
}

export interface DayAggregate {
  dayLog: DayLogModel;
  meals: MealAggregate[];
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date for a DATE column. */
export function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Append `value` to the array stored under `key`, creating it on first use. */
function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Stitch flat rows into per-meal aggregates (ordered as fetched). */
function stitch(
  meals: MealModel[],
  entries: MealEntryModel[],
  groups: LeftoverGroupModel[],
  links: { leftoverGroupId: string; mealEntryId: string }[],
): MealAggregate[] {
  const entriesByMeal = new Map<string, MealEntryModel[]>();
  for (const e of entries) pushTo(entriesByMeal, e.mealId, e);
  const idsByGroup = new Map<string, string[]>();
  for (const l of links) pushTo(idsByGroup, l.leftoverGroupId, l.mealEntryId);
  const groupsByMeal = new Map<string, { group: LeftoverGroupModel; entryIds: string[] }[]>();
  for (const g of groups)
    pushTo(groupsByMeal, g.mealId, { group: g, entryIds: idsByGroup.get(g.id) ?? [] });
  return meals.map((meal) => ({
    meal,
    entries: entriesByMeal.get(meal.id) ?? [],
    groups: groupsByMeal.get(meal.id) ?? [],
  }));
}

/** Fetch the meal/entry/leftover rows for a set of day_log ids and stitch by day. */
async function aggregateFor(dayLogs: DayLogModel[]): Promise<DayAggregate[]> {
  const dayIds = dayLogs.map((d) => d.id);
  if (dayIds.length === 0) return [];
  const meals = await prisma.meal.findMany({
    where: { dayLogId: { in: dayIds } },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });
  const mealIds = meals.map((m) => m.id);
  const [entries, groups] = await Promise.all([
    mealIds.length
      ? prisma.mealEntry.findMany({
          where: { mealId: { in: mealIds } },
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        })
      : Promise.resolve([]),
    mealIds.length
      ? prisma.leftoverGroup.findMany({ where: { mealId: { in: mealIds } } })
      : Promise.resolve([]),
  ]);
  const links = groups.length
    ? await prisma.leftoverGroupEntry.findMany({
        where: { leftoverGroupId: { in: groups.map((g) => g.id) } },
      })
    : [];
  const mealsByDay = new Map<string, MealModel[]>();
  for (const m of meals) pushTo(mealsByDay, m.dayLogId, m);
  return dayLogs.map((dayLog) => ({
    dayLog,
    meals: stitch(mealsByDay.get(dayLog.id) ?? [], entries, groups, links),
  }));
}

export const dayReadRepo = {
  /** The full day aggregate for one date, or null when the day is not logged. */
  async readAggregate(userId: string, date: string): Promise<DayAggregate | null> {
    const dayLog = await prisma.dayLog.findFirst({ where: { userId, date: toDate(date) } });
    if (!dayLog) return null;
    return (await aggregateFor([dayLog]))[0] ?? null;
  },

  /** Earliest/latest logged-day year for the user (across all years) — bounds the
   *  journal year selector (B-067). Both null when the user has no logged day. */
  async yearRange(userId: string): Promise<{ minYear: number | null; maxYear: number | null }> {
    const r = await prisma.dayLog.aggregate({
      where: { userId },
      _min: { date: true },
      _max: { date: true },
    });
    return {
      minYear: r._min.date ? r._min.date.getUTCFullYear() : null,
      maxYear: r._max.date ? r._max.date.getUTCFullYear() : null,
    };
  },

  /** All logged days of a calendar year, newest first, with their aggregates (journal). */
  async readYear(userId: string, year: number): Promise<DayAggregate[]> {
    const dayLogs = await prisma.dayLog.findMany({
      where: { userId, date: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) } },
      orderBy: [{ date: 'desc' }],
    });
    return aggregateFor(dayLogs);
  },

  /** Logged days in [from, to] (inclusive), oldest first — per-period intake stats (M4). */
  async readRange(userId: string, from: string, to: string): Promise<DayAggregate[]> {
    const dayLogs = await prisma.dayLog.findMany({
      where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
      orderBy: [{ date: 'asc' }],
    });
    return aggregateFor(dayLogs);
  },
};
