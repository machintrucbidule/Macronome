import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost } from './helpers.js';
import {
  RANDOM_UUID,
  FLOORS,
  ENTERED,
  configureAi,
  stubFetch,
  mkFood,
  seedDay,
} from './ai-suggestions.helpers.js';

// Integration contract checks for the AI meal-suggestions use (B-123; spec/api/ai.md,
// spec/logic/ai-meal-suggestions.md + meal-solver.md). Validation + not-configured + no_target run
// without any network; the provider call is exercised with a stubbed global.fetch (restored after
// each test). The headline guarantee: day_total/targets_met/gaps are recomputed in code from the
// solved quantities — never trusted from the (totals-free) model output. Shared seeding/stubbing
// helpers live in ./ai-suggestions.helpers.ts; day-awareness specs in
// ai-suggestions-day-awareness.test.ts (B-125/B-126/B-127).
const app = createApp();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /ai/meal-suggestions — validation & config (B-123)', () => {
  it('422 validation_error on an empty meal_ids / malformed date', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    expect(
      (
        await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
          date: '2026-05-01',
          meal_ids: [],
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
          date: 'not-a-date',
          meal_ids: [RANDOM_UUID],
        })
      ).status,
    ).toBe(422);
  });

  it('422 validation_error with reason=no_target when the day has no Target', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    // No seeded day/target → scaffold resolves a 0/0 calorie band → no_target.
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [RANDOM_UUID],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details.reason).toBe('no_target');
  });

  it('409 ai_not_configured when the meal_suggestions task model is unset', async () => {
    const a = await authedAgent(app, 'alice');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [RANDOM_UUID],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ai_not_configured');
  });

  it('502 ai_bad_response when the provider body has no parseable proposal', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    const mealId = await seedDay(a.userId, '2026-05-01', [1550, 1650], FLOORS, ENTERED);
    await mkFood(a.userId, 'Poulet');
    stubFetch('I cannot help with that.');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [mealId],
    });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ai_bad_response');
  });
});

describe('POST /ai/meal-suggestions — certified numbers (B-123)', () => {
  it('200: day_total/targets_met/gaps are recomputed in code (not from the model)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    const mealId = await seedDay(a.userId, '2026-05-01', [1550, 1650], FLOORS, ENTERED);
    const poulet = await mkFood(a.userId, 'Poulet', {
      per100g: { kcal: 110, fat: 2, carb: 0, protein: 23 },
    });
    const huile = await mkFood(a.userId, 'Huile', {
      per100g: { kcal: 900, fat: 100, carb: 0, protein: 0 },
    });
    // Model returns ONLY foods+meal (no quantities, no totals).
    stubFetch(
      JSON.stringify({
        proposals: [
          {
            items: [
              { food_id: poulet, meal_id: mealId, portion_id: null },
              { food_id: huile, meal_id: mealId, portion_id: null },
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

    const data = res.body.data;
    // Remaining mirrors the day context: band [630,730], need_protein 62, need_fat 22, room 80.
    expect(data.remaining).toMatchObject({
      cal_min: 630,
      cal_max: 730,
      need_protein_g: 62,
      need_fat_g: 22,
      carb_room_g: 80,
      entered: { kcal: 920, fat: 28, carb: 70, protein: 78 },
    });

    const p = data.proposals[0];
    expect(p.id).toBe('p1');
    // day_total equals entered + Σ item snaps, recomputed here from the returned items: this is the
    // server's certification, independent of the model (which sent no totals).
    type Snap = { kcal: number; fat: number; carb: number; protein: number };
    const items = p.items as { snap: Snap }[];
    const sum = (k: keyof Snap): number => items.reduce((acc, it) => acc + it.snap[k], 0);
    expect(p.day_total.kcal).toBe(Math.round(920 + sum('kcal')));
    expect(p.day_total.protein).toBe(Math.round(78 + sum('protein')));
    expect(p.day_total.fat).toBe(Math.round(28 + sum('fat')));
    expect(p.day_total.carb).toBe(Math.round(70 + sum('carb')));
    // targets_met derived from the certified total against the band/floors/ceiling.
    expect(p.targets_met.calorie).toBe(p.day_total.kcal >= 1550 && p.day_total.kcal <= 1650);
    expect(p.fit).toBe(p.gaps.length === 0 ? 'full' : 'closest');
  });

  it('200 closest fit: an unreachable fat floor surfaces a fat_floor gap (no calorie overshoot)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    const mealId = await seedDay(a.userId, '2026-05-01', [1550, 1650], FLOORS, ENTERED);
    // Only a very-lean food: reaching +22 g fat would blow far past cal_max, so the solver holds
    // calories and leaves the fat floor short (D2/D3) → closest fit with a fat_floor gap.
    const poulet = await mkFood(a.userId, 'Poulet maigre', {
      per100g: { kcal: 110, fat: 2, carb: 0, protein: 23 },
    });
    stubFetch(
      JSON.stringify({
        proposals: [{ items: [{ food_id: poulet, meal_id: mealId, portion_id: null }] }],
      }),
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [mealId],
    });
    expect(res.status).toBe(200);
    const p = res.body.data.proposals[0];
    expect(p.fit).toBe('closest');
    expect(p.targets_met.fat).toBe(false);
    expect(p.gaps.some((g: { target: string }) => g.target === 'fat_floor')).toBe(true);
    expect(p.day_total.kcal).toBeLessThanOrEqual(1650); // never overshoots calories to chase fat
  });
});

describe('POST /ai/meal-suggestions — refine constraints (B-123)', () => {
  it('honours excluded_food_ids (dropped) and a pinned quantity (held fixed)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    const mealId = await seedDay(a.userId, '2026-05-01', [1550, 1650], FLOORS, ENTERED);
    const poulet = await mkFood(a.userId, 'Poulet', {
      per100g: { kcal: 110, fat: 2, carb: 0, protein: 23 },
    });
    const huile = await mkFood(a.userId, 'Huile', {
      per100g: { kcal: 900, fat: 100, carb: 0, protein: 0 },
    });
    // The model still "picks" the excluded food + the pinned one; the solver must drop huile and
    // hold poulet at the pinned 100 g.
    stubFetch(
      JSON.stringify({
        proposals: [
          {
            items: [
              { food_id: poulet, meal_id: mealId, portion_id: null },
              { food_id: huile, meal_id: mealId, portion_id: null },
            ],
          },
        ],
      }),
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/meal-suggestions', {
      date: '2026-05-01',
      meal_ids: [mealId],
      constraints: {
        excluded_food_ids: [huile],
        pinned: [{ food_id: poulet, meal_id: mealId, portion_id: null, grams: 100 }],
      },
    });
    expect(res.status).toBe(200);
    const items = res.body.data.proposals[0].items as { food_id: string; served_grams: number }[];
    expect(items.some((it) => it.food_id === huile)).toBe(false); // excluded → dropped
    const pinned = items.find((it) => it.food_id === poulet);
    expect(pinned?.served_grams).toBe(100); // pinned → held fixed
  });
});
