import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../src/data/prisma.js';
import { seedDefaultsForUser } from '../../src/services/user-bootstrap.js';
import { normalize } from '../../src/domain/search/normalize.js';
import { FOOD_WORDS, PERF_USERNAME, SIZES } from './config.js';
import { cleanupPerfUser } from './cleanup.js';

// Seeds the throwaway user with a large, synthetic dataset (no personal data): a big food
// catalog (for trigram-search stress) and several years of detailed day logs (for the
// full-history stats read). Rows carry client-generated ids so meals/entries can be wired
// by FK and bulk-inserted via createMany without per-row round-trips.

const SLOT_NAMES = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation'] as const;
/** Per-day calorie cycle vs the 1900–2100 band → a realistic OK / NOK-over / NOK-under mix. */
const DAY_KCAL_CYCLE = [2000, 2000, 2300, 1800, 1950] as const;
/** Frozen snapshot; only cal_min/cal_max drive the read-path verdict (day-stat.ts). */
const SNAPSHOT = {
  cal_min: 1900,
  cal_max: 2100,
  protein_floor_g: 120,
  fat_floor_g: 64,
  carb_ceiling_g: 180,
};

export interface SeedResult {
  userId: string;
  /** A fully-seeded calendar year to drive the adherence measurement. */
  year: number;
  counts: { foods: number; days: number; meals: number; entries: number };
}

/** UTC-midnight date `offset` days after `start`. */
function addDays(start: Date, offset: number): Date {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** The earliest seeded day, so the run spans [start, today]. */
function startDate(totalDays: number): Date {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return addDays(today, -(totalDays - 1));
}

function buildFoodRows(userId: string): {
  foods: Prisma.FoodCreateManyInput[];
  portions: Prisma.FoodPortionCreateManyInput[];
  ids: string[];
} {
  const foods: Prisma.FoodCreateManyInput[] = [];
  const portions: Prisma.FoodPortionCreateManyInput[] = [];
  for (let i = 0; i < SIZES.foods; i++) {
    const id = randomUUID();
    const name = `${FOOD_WORDS[i % FOOD_WORDS.length]} ${i}`;
    foods.push({
      id,
      ownerId: userId,
      name,
      normalizedName: normalize(name),
      kcalPer100g: 100 + (i % 300),
      fatPer100g: i % 30,
      carbPer100g: i % 60,
      proteinPer100g: i % 25,
    });
    portions.push({ foodId: id, label: 'portion', grams: 50 + (i % 200) });
  }
  return { foods, portions, ids: foods.map((f) => f.id as string) };
}

interface DayGraph {
  days: Prisma.DayLogCreateManyInput[];
  meals: Prisma.MealCreateManyInput[];
  entries: Prisma.MealEntryCreateManyInput[];
}

/** Append one detailed day (its meals + referenced entries) to the graph accumulator. */
function appendDay(
  g: DayGraph,
  userId: string,
  date: Date,
  dayIndex: number,
  foodIds: string[],
): void {
  const dayId = randomUUID();
  g.days.push({ id: dayId, userId, date, kind: 'detailed', targetSnapshot: SNAPSHOT });
  const dayKcal = DAY_KCAL_CYCLE[dayIndex % DAY_KCAL_CYCLE.length] ?? 2000;
  const perEntry = dayKcal / (SIZES.mealsPerDay * SIZES.entriesPerMeal);
  for (let s = 0; s < SIZES.mealsPerDay; s++) {
    const mealId = randomUUID();
    g.meals.push({
      id: mealId,
      dayLogId: dayId,
      slotName: SLOT_NAMES[s % SLOT_NAMES.length]!,
      orderIndex: s,
    });
    for (let e = 0; e < SIZES.entriesPerMeal; e++) {
      const foodId = foodIds[(dayIndex * 31 + s * 7 + e) % foodIds.length]!;
      g.entries.push({
        mealId,
        kind: 'referenced',
        foodId,
        servedQuantity: 100,
        unit: 'g',
        servedGrams: 100,
        snapKcal: perEntry,
        snapFat: 5,
        snapCarb: 20,
        snapProtein: 8,
        orderIndex: e,
      });
    }
  }
}

function buildDayGraph(userId: string, foodIds: string[], totalDays: number): DayGraph {
  const start = startDate(totalDays);
  const g: DayGraph = { days: [], meals: [], entries: [] };
  for (let d = 0; d < totalDays; d++) appendDay(g, userId, addDays(start, d), d, foodIds);
  return g;
}

/** Insert rows in createMany batches to keep statements bounded. */
async function insertChunked<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += SIZES.chunk) await insert(rows.slice(i, i + SIZES.chunk));
}

export async function seedLarge(years: number): Promise<SeedResult> {
  await cleanupPerfUser(); // idempotent: clear a prior perf run first
  const user = await prisma.appUser.create({
    data: {
      username: PERF_USERNAME,
      passwordHash: 'x-perf-no-login',
      sex: 'male',
      birthdate: new Date('1986-01-01'),
      heightCm: 180,
    },
    select: { id: true },
  });
  await seedDefaultsForUser(user.id);
  await prisma.target.create({
    data: {
      userId: user.id,
      calorieMin: SNAPSHOT.cal_min,
      calorieMax: SNAPSHOT.cal_max,
      proteinGPerKg: 1.8,
      fatGPerKg: 0.8,
      effectiveFrom: new Date('2000-01-01'),
    },
  });
  const { foods, portions, ids } = buildFoodRows(user.id);
  await insertChunked(foods, (b) => prisma.food.createMany({ data: b }));
  await insertChunked(portions, (b) => prisma.foodPortion.createMany({ data: b }));
  const totalDays = years * 365;
  const { days, meals, entries } = buildDayGraph(user.id, ids, totalDays);
  await insertChunked(days, (b) => prisma.dayLog.createMany({ data: b }));
  await insertChunked(meals, (b) => prisma.meal.createMany({ data: b }));
  await insertChunked(entries, (b) => prisma.mealEntry.createMany({ data: b }));
  return {
    userId: user.id,
    year: new Date().getUTCFullYear() - 1,
    counts: {
      foods: foods.length,
      days: days.length,
      meals: meals.length,
      entries: entries.length,
    },
  };
}
