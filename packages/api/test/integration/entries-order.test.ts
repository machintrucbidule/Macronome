import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedFood, seedTarget, type Agent } from './helpers.js';

// Positional meal lines (B-028) + drag reorder (B-029): create honours an explicit
// order_index (UI adds into a chosen empty row, leaving blank rows above); the reorder
// endpoint rewrites the lines' order_index atomically and is user-scoped.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function setupMeal(name = 'alice') {
  const { agent, csrf, userId } = await authedAgent(app, name);
  await seedTarget(userId, '2026-01-01');
  const food = await seedFood(userId, 'Riz');
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const mealId = day.body.meals[0].id as string;
  return { agent, csrf, userId, food, mealId };
}

const addLine = (agent: Agent, csrf: string, mealId: string, foodId: string, orderIndex?: number) =>
  csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: 100,
    unit: 'g',
    ...(orderIndex === undefined ? {} : { order_index: orderIndex }),
  });

describe('meal entries — positional create (B-028)', () => {
  it('persists an explicit order_index (a chosen row, blank rows above allowed)', async () => {
    const { agent, csrf, mealId, food } = await setupMeal();
    const created = await addLine(agent, csrf, mealId, food.id, 4);
    expect(created.status).toBe(201);
    expect(created.body.order_index).toBe(4);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.meals[0].entries[0].order_index).toBe(4);
  });

  it('appends after the last row when order_index is omitted', async () => {
    const { agent, csrf, mealId, food } = await setupMeal();
    await addLine(agent, csrf, mealId, food.id, 2);
    const appended = await addLine(agent, csrf, mealId, food.id);
    expect(appended.body.order_index).toBe(3); // max(2) + 1
  });
});

describe('meal entries — reorder (B-029)', () => {
  it('rewrites the lines order and persists it', async () => {
    const { agent, csrf, mealId, food } = await setupMeal();
    const a = await addLine(agent, csrf, mealId, food.id, 0);
    const b = await addLine(agent, csrf, mealId, food.id, 1);

    const res = await csrfPatch(agent, csrf, `/api/v1/meals/${mealId}/entries/order`, {
      order: [
        { id: a.body.id, order_index: 1 },
        { id: b.body.id, order_index: 0 },
      ],
    });
    expect(res.status).toBe(204);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const entries = day.body.meals[0].entries as { id: string; order_index: number }[];
    expect(entries[0]?.id).toBe(b.body.id); // b now first
    expect(entries[1]?.id).toBe(a.body.id);
  });

  it('404s on another user’s meal (no cross-tenant reorder)', async () => {
    const alice = await setupMeal('alice');
    const a = await addLine(alice.agent, alice.csrf, alice.mealId, alice.food.id, 0);

    const bob = await authedAgent(app, 'bob');
    const res = await csrfPatch(
      bob.agent,
      bob.csrf,
      `/api/v1/meals/${alice.mealId}/entries/order`,
      {
        order: [{ id: a.body.id, order_index: 1 }],
      },
    );
    expect(res.status).toBe(404);
  });

  it('404s when an id is not one of the meal’s entries', async () => {
    const { agent, csrf, mealId, food } = await setupMeal();
    await addLine(agent, csrf, mealId, food.id, 0);
    const res = await csrfPatch(agent, csrf, `/api/v1/meals/${mealId}/entries/order`, {
      order: [{ id: '00000000-0000-0000-0000-000000000000', order_index: 0 }],
    });
    expect(res.status).toBe(404);
  });
});
