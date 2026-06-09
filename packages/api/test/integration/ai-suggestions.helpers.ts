import { vi } from 'vitest';
import { prisma } from '../../src/data/prisma.js';
import { csrfPatch, type Authed } from './helpers.js';

// Shared fixtures for the AI meal-suggestions integration specs (B-123). Kept out of the *.test.ts
// files so each stays within the 300-line limit. No assertions live here — only seeding + stubbing.

export const RANDOM_UUID = '11111111-2222-4333-8444-555555555555';
export const toUtc = (d: string): Date => new Date(`${d}T00:00:00.000Z`);

export interface Per100g {
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}
export interface Floors {
  protein_floor_g: number | null;
  fat_floor_g: number | null;
  carb_ceiling_g: number | null;
}

export const FLOORS: Floors = { protein_floor_g: 140, fat_floor_g: 50, carb_ceiling_g: 150 };
export const ENTERED: Per100g = { kcal: 920, fat: 28, carb: 70, protein: 78 };

/** Configure the AI link with only the meal_suggestions task enabled (a real model id). */
export async function configureAi(a: Authed): Promise<void> {
  await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
    ai: {
      provider: 'openai_compatible',
      base_url: 'https://ai.example.com/v1',
      api_key: 'k',
      tasks: {
        dish_photo_macros: { model: null, prompt: 'p' },
        meal_suggestions: { model: 'chef-x', prompt: 'Pick foods.' },
        advice: { model: null, prompt: 'p' },
      },
    },
  });
}

/** Stub global.fetch so the provider call returns the given chat-completion content. */
export function stubFetch(content: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
      ),
    ),
  );
}

interface FoodOpts {
  rating?: number | null;
  per100g?: Per100g;
  portions?: { label: string; grams: number }[];
}

export async function mkFood(userId: string, name: string, opts: FoodOpts = {}): Promise<string> {
  const p = opts.per100g ?? { kcal: 100, fat: 1, carb: 2, protein: 20 };
  const food = await prisma.food.create({
    data: {
      ownerId: userId,
      name,
      normalizedName: name.toLowerCase(),
      kcalPer100g: p.kcal,
      fatPer100g: p.fat,
      carbPer100g: p.carb,
      proteinPer100g: p.protein,
      rating: opts.rating ?? 3,
    },
    select: { id: true },
  });
  for (const portion of opts.portions ?? [])
    await prisma.foodPortion.create({ data: { foodId: food.id, ...portion } });
  return food.id;
}

/** Seed a past detailed day with a frozen target snapshot + one "already eaten" custom entry
 *  carrying the day-wide entered totals. Returns the (real) meal id for the request's meal_ids. */
export async function seedDay(
  userId: string,
  date: string,
  band: [number, number],
  floors: Floors,
  entered: Per100g,
): Promise<string> {
  const day = await prisma.dayLog.create({
    data: {
      userId,
      date: toUtc(date),
      kind: 'detailed',
      targetSnapshot: { cal_min: band[0], cal_max: band[1], ...floors },
    },
    select: { id: true },
  });
  const meal = await prisma.meal.create({
    data: { dayLogId: day.id, slotName: 'repas', orderIndex: 0 },
    select: { id: true },
  });
  await prisma.mealEntry.create({
    data: {
      mealId: meal.id,
      kind: 'custom',
      customName: 'Déjà mangé',
      unit: 'g',
      servedQuantity: 100,
      servedGrams: 100,
      snapKcal: entered.kcal,
      snapFat: entered.fat,
      snapCarb: entered.carb,
      snapProtein: entered.protein,
      orderIndex: 0,
    },
  });
  return meal.id;
}

/** Seed a detailed day whose single meal already holds referenced foods at given gram amounts
 *  (snapshots scaled from per-100 g). Used for the day-awareness exclusion (B-125/B-127). */
export async function seedDayWithFoods(
  userId: string,
  date: string,
  band: [number, number],
  floors: Floors,
  entries: { foodId: string; grams: number; per100g: Per100g }[],
): Promise<string> {
  const day = await prisma.dayLog.create({
    data: {
      userId,
      date: toUtc(date),
      kind: 'detailed',
      targetSnapshot: { cal_min: band[0], cal_max: band[1], ...floors },
    },
    select: { id: true },
  });
  const meal = await prisma.meal.create({
    data: { dayLogId: day.id, slotName: 'repas', orderIndex: 0 },
    select: { id: true },
  });
  let order = 0;
  for (const e of entries) {
    const f = e.grams / 100;
    await prisma.mealEntry.create({
      data: {
        mealId: meal.id,
        kind: 'referenced',
        foodId: e.foodId,
        unit: 'g',
        servedQuantity: e.grams,
        servedGrams: e.grams,
        snapKcal: e.per100g.kcal * f,
        snapFat: e.per100g.fat * f,
        snapCarb: e.per100g.carb * f,
        snapProtein: e.per100g.protein * f,
        orderIndex: order++,
      },
    });
  }
  return meal.id;
}
