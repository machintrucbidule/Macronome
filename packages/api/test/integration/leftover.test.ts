import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfPost,
  seedContainer,
  seedFood,
  seedTarget,
  seedWeight,
  type Agent,
} from './helpers.js';

// Integration contract checks for the leftover plate-deduction (spec/api/days-meals-
// leftover.md §Leftover, M3 acceptance): the canonical proration, and the two BLOCK cases
// that must write NOTHING (RECONCILIATION_LOG §E1). Runs against compose.test.yml Postgres.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

async function addLine(agent: Agent, csrf: string, mealId: string, foodId: string, grams: number) {
  const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: grams,
    unit: 'g',
  });
  return res.body.id as string;
}

/** Alice with a materialized day + three lines A/B/C (500/300/200 g). */
async function plate() {
  const { agent, csrf, userId } = await authedAgent(app, 'alice');
  await seedTarget(userId, '2026-01-01');
  await seedWeight(userId, '2026-01-01', 80);
  const food = await seedFood(userId, 'Riz'); // 200 kcal / 100 g
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const mealId = day.body.meals[0].id as string;
  const a = await addLine(agent, csrf, mealId, food.id, 500);
  const b = await addLine(agent, csrf, mealId, food.id, 300);
  const c = await addLine(agent, csrf, mealId, food.id, 200);
  return { agent, csrf, userId, mealId, entryIds: [a, b, c] };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('leftover', () => {
  it('prorates the canonical plate (net 100 / 1000 → consumed 450/270/180, ×0.9)', async () => {
    const { agent, csrf, userId, mealId, entryIds } = await plate();
    const container = await seedContainer(userId, 'Bowl', 408);

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 508,
      entry_ids: entryIds,
    });
    expect(res.status).toBe(201);
    expect(res.body.leftover_net_grams).toBe(100);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const entries = day.body.meals[0].entries as {
      consumed: { grams: number; kcal: number };
    }[];
    expect(entries.map((e) => e.consumed.grams)).toEqual([450, 270, 180]);
    expect(entries[0]!.consumed.kcal).toBe(900); // 1000 × 0.9
  });

  it('blocks gross < tare (409 gross_below_tare) and writes nothing', async () => {
    const { agent, csrf, userId, mealId, entryIds } = await plate();
    const container = await seedContainer(userId, 'Bowl', 408);

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 300, // 300 − 408 < 0
      entry_ids: entryIds,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('gross_below_tare');

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.meals[0].leftover_groups).toHaveLength(0); // nothing written
    expect(day.body.meals[0].entries[0].consumed.grams).toBe(500); // fully consumed
  });

  it('blocks net > served (409 leftover_exceeds_served) and writes nothing', async () => {
    const { agent, csrf, userId, mealId, entryIds } = await plate();
    const container = await seedContainer(userId, 'Bowl', 408);

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 1500, // net 1092 > 1000 served
      entry_ids: entryIds,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('leftover_exceeds_served');

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.meals[0].leftover_groups).toHaveLength(0);
  });
});
