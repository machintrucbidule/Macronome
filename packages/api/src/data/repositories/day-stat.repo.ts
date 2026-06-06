import { prisma } from '../prisma.js';

// Lightweight read for the stats domain (M9d perf). Stats only needs per-day kcal + verdict
// inputs, so this fetches narrow column projections (not full meal_entry rows) and stitches
// the per-day entry/leftover data. The per-day kcal is then computed by services/day-stat.ts
// reusing the domain proration — same figure as the full day-assembler path, far cheaper on
// the full-history scan than hydrating the whole DayAggregate. User-scoped (CLAUDE.md rule 3).

const num = (d: { toString(): string }): number => Number(d.toString());

export interface LightEntry {
  id: string;
  snapKcal: number;
  servedGrams: number | null;
}

export interface LightGroup {
  grossGrams: number;
  tareG: number;
  entryIds: string[];
}

export interface LightDay {
  date: string;
  kind: string;
  summaryKcal: number | null;
  verdictOverride: string | null;
  snapshot: { cal_min: number; cal_max: number };
  entries: LightEntry[];
  groups: LightGroup[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Fetch the narrow day/meal/entry/leftover projections for the user (optionally ranged). */
async function fetchParts(userId: string, range?: DateRange) {
  const days = await prisma.dayLog.findMany({
    where: { userId, ...(range ? { date: { gte: range.from, lte: range.to } } : {}) },
    select: {
      id: true,
      date: true,
      kind: true,
      summaryKcal: true,
      verdictOverride: true,
      targetSnapshot: true,
    },
    orderBy: [{ date: 'asc' }],
  });
  const dayIds = days.map((d) => d.id);
  const meals = dayIds.length
    ? await prisma.meal.findMany({
        where: { dayLogId: { in: dayIds } },
        select: { id: true, dayLogId: true },
      })
    : [];
  const mealIds = meals.map((m) => m.id);
  const [entries, groups] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { mealId: { in: mealIds } },
      select: { id: true, mealId: true, snapKcal: true, servedGrams: true },
    }),
    prisma.leftoverGroup.findMany({
      where: { mealId: { in: mealIds } },
      select: { id: true, mealId: true, grossGrams: true, tareG: true },
    }),
  ]);
  const links = groups.length
    ? await prisma.leftoverGroupEntry.findMany({
        where: { leftoverGroupId: { in: groups.map((g) => g.id) } },
      })
    : [];
  return { days, meals, entries, groups, links };
}

/** Stitch the flat projections into per-day light records (ordered as fetched, oldest first). */
function stitch(parts: Awaited<ReturnType<typeof fetchParts>>): LightDay[] {
  const { days, meals, entries, groups, links } = parts;
  const dayByMeal = new Map(meals.map((m) => [m.id, m.dayLogId]));
  const entriesByDay = new Map<string, LightEntry[]>();
  for (const e of entries) {
    const dayId = dayByMeal.get(e.mealId);
    if (dayId)
      pushTo(entriesByDay, dayId, {
        id: e.id,
        snapKcal: num(e.snapKcal),
        servedGrams: e.servedGrams === null ? null : num(e.servedGrams),
      });
  }
  const idsByGroup = new Map<string, string[]>();
  for (const l of links) pushTo(idsByGroup, l.leftoverGroupId, l.mealEntryId);
  const groupsByDay = new Map<string, LightGroup[]>();
  for (const g of groups) {
    const dayId = dayByMeal.get(g.mealId);
    if (dayId)
      pushTo(groupsByDay, dayId, {
        grossGrams: num(g.grossGrams),
        tareG: num(g.tareG),
        entryIds: idsByGroup.get(g.id) ?? [],
      });
  }
  return days.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    kind: d.kind,
    summaryKcal: d.summaryKcal === null ? null : num(d.summaryKcal),
    verdictOverride: d.verdictOverride,
    snapshot: d.targetSnapshot as unknown as { cal_min: number; cal_max: number },
    entries: entriesByDay.get(d.id) ?? [],
    groups: groupsByDay.get(d.id) ?? [],
  }));
}

export const dayStatRepo = {
  /** Lightweight logged-day records, oldest first; pass a range to narrow (rolling windows). */
  async readLightweight(userId: string, range?: DateRange): Promise<LightDay[]> {
    return stitch(await fetchParts(userId, range));
  },

  /** Latest day_log date for the user (rolling anchor bound), or null when none exist. */
  async latestDate(userId: string): Promise<Date | null> {
    const r = await prisma.dayLog.aggregate({ where: { userId }, _max: { date: true } });
    return r._max.date ?? null;
  },

  /** Activity levels of logged days within [from, to] (recent-average activity, Cibles). */
  async activityLevelsInRange(userId: string, from: Date, to: Date): Promise<string[]> {
    const rows = await prisma.dayLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: { activityLevel: true },
      orderBy: [{ date: 'asc' }],
    });
    return rows.map((r) => r.activityLevel);
  },
};
