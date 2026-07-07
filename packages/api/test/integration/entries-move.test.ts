import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, seedTarget, type Agent } from './helpers.js';

// Cross-meal move (B-187/B-188): POST /meals/:mealId/entries/:id/move re-parents a line
// to another meal of the SAME day. Only meal_id + order_index change — the frozen macro
// snapshot is untouched. Landing: explicit order_index, else appended after the target's
// last row. Same-meal → no-op 200; cross-day → 422; leftover-grouped line → 422 (blocked);
// cross-tenant/unknown → 404.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);
const OTHER_DAY = '2026-01-15';
const ZERO_ID = '00000000-0000-0000-0000-000000000000';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function setupDay(name = 'alice') {
  const { agent, csrf, userId } = await authedAgent(app, name);
  await seedTarget(userId, '2026-01-01');
  const food = await seedFood(userId, 'Riz');
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const meals = day.body.meals as { id: string }[];
  const sourceId = meals[0]!.id;
  // A guaranteed second meal on the same day (templates may seed only one).
  const created = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/meals`, {
    slot_name: 'Goûter',
    order_index: meals.length,
  });
  const targetId = created.body.id as string;
  return { agent, csrf, userId, food, sourceId, targetId };
}

const addLine = (agent: Agent, csrf: string, mealId: string, foodId: string, orderIndex?: number) =>
  csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: 100,
    unit: 'g',
    ...(orderIndex === undefined ? {} : { order_index: orderIndex }),
  });

const moveLine = (
  agent: Agent,
  csrf: string,
  mealId: string,
  id: string,
  body: Record<string, unknown>,
) => csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${id}/move`, body);

describe('meal entries — move to another meal (B-187/B-188)', () => {
  it('appends after the target meal’s last row and keeps the snapshot untouched', async () => {
    const { agent, csrf, sourceId, targetId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 3);
    await addLine(agent, csrf, targetId, food.id, 5); // target's last filled row = 5
    const snapBefore = line.body.snap as Record<string, number>;

    const res = await moveLine(agent, csrf, sourceId, line.body.id, { target_meal_id: targetId });
    expect(res.status).toBe(200);
    expect(res.body.order_index).toBe(6); // max(5) + 1
    expect(res.body.snap).toEqual(snapBefore);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const meals = day.body.meals as { id: string; entries: { id: string }[] }[];
    expect(meals.find((m) => m.id === sourceId)?.entries).toHaveLength(0);
    expect(meals.find((m) => m.id === targetId)?.entries.map((e) => e.id)).toContain(line.body.id);
  });

  it('honours an explicit order_index (drop on an empty row)', async () => {
    const { agent, csrf, sourceId, targetId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 0);

    const res = await moveLine(agent, csrf, sourceId, line.body.id, {
      target_meal_id: targetId,
      order_index: 7,
    });
    expect(res.status).toBe(200);
    expect(res.body.order_index).toBe(7);
  });

  it('is a no-op 200 when the target is the line’s own meal', async () => {
    const { agent, csrf, sourceId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 2);

    const res = await moveLine(agent, csrf, sourceId, line.body.id, { target_meal_id: sourceId });
    expect(res.status).toBe(200);
    expect(res.body.order_index).toBe(2); // unchanged
  });
});

describe('meal entries — move guards (B-187/B-188)', () => {
  it('422s on a target meal of another day, nothing moved', async () => {
    const { agent, csrf, sourceId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 0);
    const otherDay = await csrfPost(agent, csrf, `/api/v1/days/${OTHER_DAY}`);
    const foreignDayMealId = otherDay.body.meals[0].id as string;

    const res = await moveLine(agent, csrf, sourceId, line.body.id, {
      target_meal_id: foreignDayMealId,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.target_meal_id).toBe('different_day');

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const source = (day.body.meals as { id: string; entries: unknown[] }[]).find(
      (m) => m.id === sourceId,
    );
    expect(source?.entries).toHaveLength(1); // still in place
  });

  it('422s on a line inside a leftover group, nothing moved', async () => {
    const { agent, csrf, sourceId, targetId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 0);
    const grouped = await csrfPost(agent, csrf, `/api/v1/meals/${sourceId}/leftover`, {
      container_id: null,
      gross_grams: 40,
      entry_ids: [line.body.id],
    });
    expect(grouped.status).toBe(201);

    const res = await moveLine(agent, csrf, sourceId, line.body.id, { target_meal_id: targetId });
    expect(res.status).toBe(422);
    expect(res.body.error.details.entry_id).toBe('entry_in_leftover_group');

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const source = (day.body.meals as { id: string; entries: unknown[] }[]).find(
      (m) => m.id === sourceId,
    );
    expect(source?.entries).toHaveLength(1);
  });

  it('404s cross-tenant, both directions', async () => {
    const alice = await setupDay('alice');
    const line = await addLine(alice.agent, alice.csrf, alice.sourceId, alice.food.id, 0);
    const bob = await setupDay('bob');

    // Bob moving Alice's entry → 404.
    const steal = await moveLine(bob.agent, bob.csrf, alice.sourceId, line.body.id, {
      target_meal_id: bob.targetId,
    });
    expect(steal.status).toBe(404);

    // Alice moving her entry to Bob's meal → 404.
    const leak = await moveLine(alice.agent, alice.csrf, alice.sourceId, line.body.id, {
      target_meal_id: bob.targetId,
    });
    expect(leak.status).toBe(404);
  });

  it('404s on an unknown entry or unknown target meal', async () => {
    const { agent, csrf, sourceId, targetId, food } = await setupDay();
    const line = await addLine(agent, csrf, sourceId, food.id, 0);

    const noEntry = await moveLine(agent, csrf, sourceId, ZERO_ID, { target_meal_id: targetId });
    expect(noEntry.status).toBe(404);

    const noMeal = await moveLine(agent, csrf, sourceId, line.body.id, { target_meal_id: ZERO_ID });
    expect(noMeal.status).toBe(404);
  });
});
