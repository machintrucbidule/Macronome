import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, type Agent } from './helpers.js';

// LD-1 / B-303: a list page can now be asked for by `offset` as well as by `cursor`
// (spec/api/00-conventions.md §List behaviour). A cursor is a row id, so it can only say "the page
// after this row" — useless to a client that dropped its scrollbar into the middle of a 3 400-row
// catalog. The contract these tests pin: **the page at `offset = k·limit` is exactly the page a
// cursor walk reaches after k steps**, on all three lists, with the same `total` either way.
const app = createApp();

const ids = (res: { body: { data: { id: string }[] } }): string[] => res.body.data.map((r) => r.id);

/** Walk `steps` cursor pages and return the ids of the page that lands last. */
async function walk(agent: Agent, path: string, limit: number, steps: number): Promise<string[]> {
  let res = await agent.get(path).query({ limit });
  for (let i = 0; i < steps; i += 1) {
    res = await agent.get(path).query({ limit, cursor: res.body.next_cursor as string });
  }
  return ids(res);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('offset paging — the Ciqual catalog (B-303)', () => {
  it('lands on exactly the page a cursor walk would reach', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const walked = await walk(agent, '/api/v1/food-refs', 10, 2); // pages 1 → 2 → 3

    const jumped = await agent.get('/api/v1/food-refs').query({ limit: 10, offset: 20 });
    expect(jumped.status).toBe(200);
    expect(ids(jumped)).toEqual(walked);
  });

  it('reports the same total as the cursor path, and still carries next_cursor', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const first = await agent.get('/api/v1/food-refs').query({ limit: 10 });
    const jumped = await agent.get('/api/v1/food-refs').query({ limit: 10, offset: 3000 });

    // Every page reports the same figure whichever way it was addressed (D30) — the client sizes
    // its scrollbar from whichever page happens to arrive first, and after a jump that is not #1.
    expect(jumped.body.total).toBe(first.body.total);
    expect(jumped.body.next_cursor).toBeTruthy();
  });

  it('offset: 0 is the first page', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const first = await agent.get('/api/v1/food-refs').query({ limit: 10 });
    const zero = await agent.get('/api/v1/food-refs').query({ limit: 10, offset: 0 });
    expect(ids(zero)).toEqual(ids(first));
  });

  it('past the end returns an empty page, not an error', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/food-refs').query({ limit: 10, offset: 999_999 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.next_cursor).toBeNull();
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('honours the filters and the sort it jumps into', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const q = { limit: 5, sort: 'kcal', dir: 'desc' as const };
    const walked = await walk(agent, '/api/v1/food-refs', 5, 1);
    const jumped = await agent.get('/api/v1/food-refs').query({ ...q, offset: 5 });
    const walkedSorted = await agent
      .get('/api/v1/food-refs')
      .query({ ...q, cursor: (await agent.get('/api/v1/food-refs').query(q)).body.next_cursor });
    expect(ids(jumped)).toEqual(ids(walkedSorted));
    expect(walked).toHaveLength(5);
  });

  it('refuses cursor and offset together with 422', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const first = await agent.get('/api/v1/food-refs').query({ limit: 10 });
    const res = await agent
      .get('/api/v1/food-refs')
      .query({ limit: 10, cursor: first.body.next_cursor as string, offset: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });
});

describe('offset paging — foods and recipes (B-303)', () => {
  /** 12 foods, so a limit of 5 gives three pages. */
  async function seedFoods(userId: string): Promise<void> {
    for (let i = 0; i < 12; i += 1) {
      await seedFood(userId, `Aliment ${String(i).padStart(2, '0')}`);
    }
  }

  it('foods: offset lands on the cursor walk’s page', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    await seedFoods(userId);
    const walked = await walk(agent, '/api/v1/foods', 5, 1);
    const jumped = await agent.get('/api/v1/foods').query({ limit: 5, offset: 5 });
    expect(ids(jumped)).toEqual(walked);
    expect(jumped.body.total).toBe(12);
  });

  it('foods: the usage sort honours offset too, though it ranks in memory', async () => {
    const { agent, userId } = await authedAgent(app, 'carol');
    await seedFoods(userId);
    const q = { limit: 5, sort: 'usage', dir: 'desc' as const };
    const first = await agent.get('/api/v1/foods').query(q);
    const walked = await agent
      .get('/api/v1/foods')
      .query({ ...q, cursor: first.body.next_cursor as string });
    const jumped = await agent.get('/api/v1/foods').query({ ...q, offset: 5 });
    expect(ids(jumped)).toEqual(ids(walked));
    expect(jumped.body.total).toBe(first.body.total);
  });

  it('foods: cursor and offset together → 422', async () => {
    const { agent, userId } = await authedAgent(app, 'dave');
    await seedFoods(userId);
    const first = await agent.get('/api/v1/foods').query({ limit: 5 });
    const res = await agent
      .get('/api/v1/foods')
      .query({ limit: 5, cursor: first.body.next_cursor as string, offset: 5 });
    expect(res.status).toBe(422);
  });

  it('recipes: offset lands on the cursor walk’s page', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    const food = await seedFood(userId, 'Farine');
    for (let i = 0; i < 6; i += 1) {
      await csrfPost(agent, csrf, '/api/v1/recipes', {
        name: `Recette ${String(i)}`,
        servings: 2,
        total_batch_grams: 500,
        ingredients: [
          { ref_type: 'food', ref_id: food.id, quantity: 100, unit: 'g', order_index: 0 },
        ],
      });
    }
    const walked = await walk(agent, '/api/v1/recipes', 2, 1);
    const jumped = await agent.get('/api/v1/recipes').query({ limit: 2, offset: 2 });
    expect(ids(jumped)).toEqual(walked);
  });
});
