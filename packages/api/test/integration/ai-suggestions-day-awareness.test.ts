import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost } from './helpers.js';
import {
  FLOORS,
  configureAi,
  stubFetch,
  mkFood,
  seedDayWithFoods,
  type Per100g,
} from './ai-suggestions.helpers.js';

// Day-awareness integration specs (B-125/B-126/B-127; spec/logic/ai-meal-suggestions.md §2.2/§3.1).
// A food already eaten >25 g on the working day is removed from the candidate pool, so the chef can
// never re-propose it (the parse drops it even when the model returns it); a never-eaten food stays
// proposable. The ≤25-g condiment branch is covered deterministically by the day-used unit test.
const app = createApp();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /ai/meal-suggestions — day-awareness (B-125/B-126/B-127)', () => {
  it('drops a food eaten >25 g today (no re-proposal); a never-eaten food is still proposed', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    const pouletMacros: Per100g = { kcal: 110, fat: 2, carb: 0, protein: 23 };
    const poulet = await mkFood(a.userId, 'Poulet', { per100g: pouletMacros });
    const brocoli = await mkFood(a.userId, 'Brocoli', {
      per100g: { kcal: 34, fat: 0.4, carb: 7, protein: 2.8 },
    });
    // Poulet 200 g already eaten today → must be removed from the candidate pool (>25 g).
    const mealId = await seedDayWithFoods(a.userId, '2026-05-01', [1550, 1650], FLOORS, [
      { foodId: poulet, grams: 200, per100g: pouletMacros },
    ]);
    // The chef re-proposes the eaten poulet (must be dropped) + a fresh brocoli (must be kept).
    stubFetch(
      JSON.stringify({
        proposals: [
          {
            items: [
              { food_id: poulet, meal_id: mealId, portion_id: null },
              { food_id: brocoli, meal_id: mealId, portion_id: null },
            ],
          },
        ],
      }),
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [mealId],
    });
    expect(res.status).toBe(200);
    const ids = (res.body.data.proposals[0].items as { food_id: string }[]).map((it) => it.food_id);
    expect(ids).not.toContain(poulet); // eaten 200 g today → removed from pool → dropped at parse
    expect(ids).toContain(brocoli); // never eaten → still proposable
  });
});
