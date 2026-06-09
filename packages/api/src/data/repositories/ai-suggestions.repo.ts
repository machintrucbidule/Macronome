import type { Food as FoodModel, FoodPortion as FoodPortionModel } from '@prisma/client';
import { MAX_CANDIDATE_FOODS, OK_DAY_HISTORY_WINDOW_DAYS, type Rating } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { logger } from '../../observability/logger.js';
import { dayStatRepo } from './day-stat.repo.js';
import { dayStat } from '../../services/day-stat.js';
import type { ChefFood, HistoryDay } from '../../domain/ai-meal-suggestions/index.js';

// AI meal-suggestions read layer (spec/logic/ai-meal-suggestions.md §3–§4, B-123). Two user-scoped
// reads feeding the chef context (CLAUDE.md rule 3): the candidate pool (eligible foods, ranked +
// capped) and the OK-day history sample. No proposal quantities/verdicts are computed here — the
// solver/verifier (meal-solver/) own those. The OK filter reuses day-stat's canonical (prorated)
// day verdict so "OK day" matches exactly what the journal/stats show (frozen-history pattern).

const num = (d: { toString(): string }): number => Number(d.toString());
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const toUtc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

// --- candidate pool (§3) -----------------------------------------------------------------------

/** Rank key for rating, unrated (null) last — D8: prefer 3 > 2 > 1, unrated deprioritised. */
const ratingRank = (r: number | null): number => r ?? -1;

/** Order: rating desc (unrated last), then recency of use desc (never-eaten last), then name. */
function rankCmp(a: FoodModel, b: FoodModel, lastEaten: Map<string, string>): number {
  const byRating = ratingRank(b.rating) - ratingRank(a.rating);
  if (byRating !== 0) return byRating;
  const la = lastEaten.get(a.id) ?? '';
  const lb = lastEaten.get(b.id) ?? '';
  if (la !== lb) return la < lb ? 1 : -1; // newer date first; '' (never eaten) sorts last
  return a.name.localeCompare(b.name);
}

/** foodId → most recent date (YYYY-MM-DD) the food was eaten, over the user's logged days. */
async function lastEatenMap(userId: string, foodIds: string[]): Promise<Map<string, string>> {
  const days = await prisma.dayLog.findMany({
    where: { userId },
    select: { id: true, date: true },
  });
  if (days.length === 0) return new Map();
  const meals = await prisma.meal.findMany({
    where: { dayLogId: { in: days.map((d) => d.id) } },
    select: { id: true, dayLogId: true },
  });
  if (meals.length === 0) return new Map();
  const entries = await prisma.mealEntry.findMany({
    where: { mealId: { in: meals.map((m) => m.id) }, foodId: { in: foodIds } },
    select: { mealId: true, foodId: true },
  });
  const dateByDay = new Map(days.map((d) => [d.id, isoDate(d.date)]));
  const dayByMeal = new Map(meals.map((m) => [m.id, m.dayLogId]));
  const last = new Map<string, string>();
  for (const e of entries) {
    if (!e.foodId) continue;
    const date = dateByDay.get(dayByMeal.get(e.mealId) ?? '');
    if (!date) continue;
    const cur = last.get(e.foodId);
    if (!cur || date > cur) last.set(e.foodId, date);
  }
  return last;
}

/** Attach portions and map the ranked Prisma rows to the chef-context shape (§2.2). */
async function toChefFoods(foods: FoodModel[]): Promise<ChefFood[]> {
  const portions = foods.length
    ? await prisma.foodPortion.findMany({
        where: { foodId: { in: foods.map((f) => f.id) } },
        orderBy: [{ label: 'asc' }],
      })
    : [];
  const byFood = new Map<string, FoodPortionModel[]>();
  for (const p of portions) pushTo(byFood, p.foodId, p);
  return foods.map((f) => ({
    food_id: f.id,
    name: f.name,
    per100g: {
      kcal: num(f.kcalPer100g),
      protein: num(f.proteinPer100g),
      fat: num(f.fatPer100g),
      carb: num(f.carbPer100g),
    },
    rating: (f.rating ?? null) as Rating,
    portions: (byFood.get(f.id) ?? []).map((p) => ({
      portion_id: p.id,
      label: p.label,
      grams: num(p.grams),
    })),
  }));
}

// --- OK-day history (§4) -----------------------------------------------------------------------

interface HistoryEntryRow {
  mealId: string;
  kind: string;
  foodId: string | null;
  customName: string | null;
  servedGrams: { toString(): string } | null;
  servedQuantity: { toString(): string };
}

/** One history line, or null when there is nothing real to show (zero-qty prefill / no name). */
function toHistoryFood(
  e: HistoryEntryRow,
  nameById: Map<string, string>,
): { name: string; qty: string } | null {
  const grams = e.servedGrams != null ? num(e.servedGrams) : num(e.servedQuantity);
  if (grams <= 0) return null; // skip zero-qty (garde-manger pre-fill) lines — nothing was eaten
  const name =
    e.kind === 'custom' ? e.customName : e.foodId ? (nameById.get(e.foodId) ?? null) : null;
  if (!name) return null; // unresolvable (deleted food, no custom name)
  return { name, qty: `${Math.round(grams)} g` };
}

/** Build the per-(day, meal) history sample for the given OK dates (already newest-first). */
async function buildHistory(
  userId: string,
  before: string,
  dates: string[],
): Promise<HistoryDay[]> {
  const days = await prisma.dayLog.findMany({
    where: { userId, date: { in: dates.map(toUtc) } },
    select: { id: true, date: true },
  });
  const meals = await prisma.meal.findMany({
    where: { dayLogId: { in: days.map((d) => d.id) } },
    select: { id: true, dayLogId: true, slotName: true, orderIndex: true },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });
  const entries = meals.length
    ? await prisma.mealEntry.findMany({
        where: { mealId: { in: meals.map((m) => m.id) } },
        select: {
          mealId: true,
          kind: true,
          foodId: true,
          customName: true,
          servedGrams: true,
          servedQuantity: true,
        },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      })
    : [];
  const foodIds = [...new Set(entries.map((e) => e.foodId).filter((x): x is string => x !== null))];
  const foods = foodIds.length
    ? await prisma.food.findMany({
        where: { id: { in: foodIds }, ownerId: userId },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(foods.map((f) => [f.id, f.name]));
  const entriesByMeal = new Map<string, HistoryEntryRow[]>();
  for (const e of entries) pushTo(entriesByMeal, e.mealId, e);
  const beforeMs = toUtc(before).getTime();

  const out: HistoryDay[] = [];
  for (const date of dates) {
    const day = days.find((d) => isoDate(d.date) === date);
    if (!day) continue;
    const offset = Math.round((toUtc(date).getTime() - beforeMs) / 86_400_000);
    for (const m of meals.filter((x) => x.dayLogId === day.id)) {
      const list = (entriesByMeal.get(m.id) ?? [])
        .map((e) => toHistoryFood(e, nameById))
        .filter((x): x is { name: string; qty: string } => x !== null);
      if (list.length > 0) out.push({ date_offset: offset, meal_name: m.slotName, foods: list });
    }
  }
  return out;
}

export const aiSuggestionsRepo = {
  /** Eligible candidate foods (§3): `ai_proposable AND rating ≠ 0`, non-archived, non-recipe;
   *  ranked rating-desc then recency-of-use, capped at `limit` (the cap is logged, never hidden). */
  async candidatePool(userId: string, limit = MAX_CANDIDATE_FOODS): Promise<ChefFood[]> {
    const foods = await prisma.food.findMany({
      where: {
        ownerId: userId,
        archivedAt: null,
        aiProposable: true,
        source: { not: 'recipe' },
        OR: [{ rating: null }, { rating: { gte: 1 } }], // keep unrated; exclude only Bof (0)
      },
    });
    if (foods.length === 0) return [];
    const lastEaten = await lastEatenMap(
      userId,
      foods.map((f) => f.id),
    );
    const ranked = [...foods].sort((a, b) => rankCmp(a, b, lastEaten));
    if (ranked.length > limit) {
      logger.info(
        { userId, total: ranked.length, cap: limit },
        'ai_meal_suggestions candidate pool capped',
      );
    }
    return toChefFoods(ranked.slice(0, limit));
  },

  /** The most recent `limit` detailed days before `before` whose canonical (prorated) verdict is
   *  OK, newest-first, with the foods + quantities per meal (names + amounts only, Privacy §5). */
  async okDayHistory(
    userId: string,
    before: string,
    limit = OK_DAY_HISTORY_WINDOW_DAYS,
  ): Promise<HistoryDay[]> {
    const lightDays = await dayStatRepo.readLightweight(userId);
    const okDates = lightDays
      .filter((d) => d.kind === 'detailed' && d.date < before)
      .filter((d) => dayStat(d)?.verdict === 'OK')
      .map((d) => d.date)
      .sort((a, b) => (a < b ? 1 : -1)) // newest first
      .slice(0, limit);
    if (okDates.length === 0) return [];
    return buildHistory(userId, before, okDates);
  },

  /** Resolve `food_id → name` for the given ids, user-scoped (CLAUDE.md rule 3). Feeds the
   *  ALREADY ON THE DAY context section, whose referenced entries carry only ids (B-125/B-127). */
  async foodNamesByIds(userId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const foods = await prisma.food.findMany({
      where: { id: { in: ids }, ownerId: userId },
      select: { id: true, name: true },
    });
    return new Map(foods.map((f) => [f.id, f.name]));
  },
};
