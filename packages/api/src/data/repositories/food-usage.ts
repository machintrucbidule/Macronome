import { FOOD_USAGE_WINDOW_DAYS } from '@macronome/shared';
import { prisma } from '../prisma.js';

// Search-picker usage ranking (FU-1/B-151). Usage is DERIVED at query time from meal_entry — no
// stored column — so the pickers list foods (and loggable recipes, logged via their derived food)
// most-used-first. Recipes reference their derived `food` row by meal_entry.food_id, so one
// per-food_id aggregation ranks both. Extends the AI lastEatenMap pattern (ai-suggestions.repo.ts)
// with a count and a bounded window. User-scoped via day_log (CLAUDE.md rule 3).

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface UsageInfo {
  /** Number of times the food was logged within the window. */
  count: number;
  /** Most recent log date (YYYY-MM-DD) within the window; '' when never logged. */
  lastUsed: string;
}

/** Start of the usage window (UTC midnight, `today − FOOD_USAGE_WINDOW_DAYS`). */
function windowStart(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - FOOD_USAGE_WINDOW_DAYS);
  return new Date(`${isoDate(d)}T00:00:00.000Z`);
}

/** foodId → { count, lastUsed } over the user's logged days within the 90-day window. Foods with
 *  no logged entry in the window are simply absent from the map (treated as count 0 by callers). */
export async function foodUsageMap(
  userId: string,
  foodIds: string[],
): Promise<Map<string, UsageInfo>> {
  const out = new Map<string, UsageInfo>();
  if (foodIds.length === 0) return out;
  const days = await prisma.dayLog.findMany({
    where: { userId, date: { gte: windowStart() } },
    select: { id: true, date: true },
  });
  if (days.length === 0) return out;
  const meals = await prisma.meal.findMany({
    where: { dayLogId: { in: days.map((d) => d.id) } },
    select: { id: true, dayLogId: true },
  });
  if (meals.length === 0) return out;
  const entries = await prisma.mealEntry.findMany({
    where: { mealId: { in: meals.map((m) => m.id) }, foodId: { in: foodIds } },
    select: { mealId: true, foodId: true },
  });
  const dateByDay = new Map(days.map((d) => [d.id, isoDate(d.date)]));
  const dayByMeal = new Map(meals.map((m) => [m.id, m.dayLogId]));
  for (const e of entries) {
    if (!e.foodId) continue;
    const date = dateByDay.get(dayByMeal.get(e.mealId) ?? '');
    if (!date) continue;
    const cur = out.get(e.foodId);
    if (cur) {
      cur.count += 1;
      if (date > cur.lastUsed) cur.lastUsed = date;
    } else {
      out.set(e.foodId, { count: 1, lastUsed: date });
    }
  }
  return out;
}

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const usageOf = (m: Map<string, UsageInfo>, id: string): UsageInfo =>
  m.get(id) ?? { count: 0, lastUsed: '' };

/** Total order for "most-used-first" (FU-1): count, then most-recent use, then name, then id (a
 *  stable final tiebreak so the order is identical across paginated calls). `dir` flips the count
 *  axis only ('desc' = most-used first, the picker default). Never-logged foods (count 0) sink. */
export function rankByUsage<T extends { id: string; name: string }>(
  items: T[],
  usage: Map<string, UsageInfo>,
  dir: 'asc' | 'desc',
): T[] {
  const sign = dir === 'asc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const ua = usageOf(usage, a.id);
    const ub = usageOf(usage, b.id);
    if (ua.count !== ub.count) return (ub.count - ua.count) * sign;
    if (ua.lastUsed !== ub.lastUsed) return cmpStr(ub.lastUsed, ua.lastUsed); // most recent first
    return a.name.localeCompare(b.name) || cmpStr(a.id, b.id);
  });
}
