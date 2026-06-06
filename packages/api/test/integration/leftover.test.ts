import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfPatch,
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

describe('leftover preview & re-edit (B-047)', () => {
  it('previews per-line consumed (net 100 / 1000 → 450/270/180) without writing (B-047)', async () => {
    const { agent, csrf, mealId, entryIds } = await plate();

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover/preview`, {
      entry_ids: entryIds,
      gross_grams: 508,
      tare_g: 408,
    });
    expect(res.status).toBe(200);
    expect(res.body.net_grams).toBe(100);
    expect(res.body.served_total).toBe(1000);
    expect(res.body.blocked).toBeNull();
    const byId = Object.fromEntries(
      (res.body.lines as { entry_id: string; consumed_grams: number }[]).map((l) => [
        l.entry_id,
        l.consumed_grams,
      ]),
    );
    expect([byId[entryIds[0]!], byId[entryIds[1]!], byId[entryIds[2]!]]).toEqual([450, 270, 180]);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.meals[0].leftover_groups).toHaveLength(0); // preview persists nothing
  });

  it('preview flags blocked drafts (gross < tare, net > served)', async () => {
    const { agent, csrf, mealId, entryIds } = await plate();
    const url = `/api/v1/meals/${mealId}/leftover/preview`;

    const below = await csrfPost(agent, csrf, url, {
      entry_ids: entryIds,
      gross_grams: 300,
      tare_g: 408,
    });
    expect(below.body.blocked).toBe('gross_below_tare');
    const exceeds = await csrfPost(agent, csrf, url, {
      entry_ids: entryIds,
      gross_grams: 1500,
      tare_g: 408,
    });
    expect(exceeds.body.blocked).toBe('leftover_exceeds_served');
  });

  it('exposes consumed.quantity scaled by the applied leftover (B-047)', async () => {
    const { agent, csrf, userId, mealId, entryIds } = await plate();
    const container = await seedContainer(userId, 'Bowl', 408);

    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 508,
      entry_ids: entryIds,
    });
    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const entries = day.body.meals[0].entries as { consumed: { quantity: number } }[];
    // g unit: served_quantity == grams, so consumed.quantity tracks consumed grams.
    expect(entries.map((e) => e.consumed.quantity)).toEqual([450, 270, 180]);
  });

  it('re-edits a group via PATCH and recomputes consumed (smaller net = more eaten)', async () => {
    const { agent, csrf, userId, mealId, entryIds } = await plate();
    const container = await seedContainer(userId, 'Bowl', 408);
    const created = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 508, // net 100
      entry_ids: entryIds,
    });
    const groupId = created.body.id as string;

    const patched = await csrfPatch(agent, csrf, `/api/v1/leftover/${groupId}`, {
      gross_grams: 458, // net 50 → A consumes 500 − 50×500/1000 = 475
    });
    expect(patched.status).toBe(200);
    expect(patched.body.leftover_net_grams).toBe(50);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const grams = (day.body.meals[0].entries as { consumed: { grams: number } }[]).map(
      (e) => e.consumed.grams,
    );
    expect(grams).toEqual([475, 285, 190]); // ×0.95
  });
});
