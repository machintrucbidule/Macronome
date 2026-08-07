import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, type Agent } from './helpers.js';

// BE-1: `GET /foods/ids`, `PATCH /foods/bulk`, `POST /foods/bulk/undo`
// (spec/api/00-conventions.md §Bulk writes). What these cases pin: the patch semantics are the
// single-row PATCH's (absent = untouched, null = cleared), the ids endpoint resolves EXACTLY the
// set the list shows, an id that is not the user's writes nothing at all, and the undo is
// single-level.
const app = createApp();

const patch = (agent: Agent, csrf: string, body: Record<string, unknown>) =>
  agent.patch('/api/v1/foods/bulk').set('x-csrf-token', csrf).send(body);

const macros = { kcal_per_100g: 100, fat_per_100g: 1, carb_per_100g: 2, protein_per_100g: 3 };

/** Three ordinary foods, created through the API so every default is the real one. */
async function seedThree(agent: Agent, csrf: string): Promise<string[]> {
  const ids: string[] = [];
  for (const name of ['Avoine', 'Beurre', 'Cabillaud']) {
    const res = await csrfPost(agent, csrf, '/api/v1/foods', {
      name,
      ...macros,
      comment: `note sur ${name}`,
      rating: 1,
    });
    expect(res.status).toBe(201);
    ids.push(res.body.data.id as string);
  }
  return ids;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PATCH /foods/bulk (BE-1)', () => {
  it('writes only the fields sent and leaves the others exactly as they were', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);

    const res = await patch(agent, csrf, { ids, patch: { rating: 3, visibility: 'shared' } });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);

    const list = await agent.get('/api/v1/foods').query({ sort: 'name' });
    for (const food of list.body.data) {
      expect(food).toMatchObject({ rating: 3, visibility: 'shared' });
      // Untouched: they were never in the request body.
      expect(food.comment).toBe(`note sur ${food.name as string}`);
      expect(food).toMatchObject({ source: 'manual', ai_proposable: true, kcal_per_100g: 100 });
    }
  });

  it('clears the comment on `null` and un-rates on `rating: null`', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);

    const res = await patch(agent, csrf, { ids, patch: { comment: null, rating: null } });
    expect(res.status).toBe(200);

    const list = await agent.get('/api/v1/foods');
    for (const food of list.body.data) {
      expect(food.comment).toBeNull();
      expect(food.rating).toBeNull();
    }
  });

  it('refuses a patch that would change nothing, and an empty id list', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);

    const empty = await patch(agent, csrf, { ids, patch: {} });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('validation_error');

    const noIds = await patch(agent, csrf, { ids: [], patch: { rating: 2 } });
    expect(noIds.status).toBe(422);
  });

  it('refuses more ids than the ceiling allows', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const tooMany = Array.from(
      { length: 5001 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    const res = await patch(agent, csrf, { ids: tooMany, patch: { rating: 2 } });
    expect(res.status).toBe(422);
  });

  it('writes NOTHING when one id belongs to someone else', async () => {
    const alice = await authedAgent(app, 'alice');
    const bob = await authedAgent(app, 'bob');
    const mine = await seedThree(alice.agent, alice.csrf);
    const theirs = await seedFood(bob.userId, 'Chez Bob');

    const res = await patch(alice.agent, alice.csrf, {
      ids: [...mine, theirs.id],
      patch: { rating: 3 },
    });
    expect(res.status).toBe(404);

    // The two of mine in the same request must be untouched — all or nothing.
    const list = await alice.agent.get('/api/v1/foods');
    for (const food of list.body.data) expect(food.rating).toBe(1);
    const other = await prisma.food.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(other.rating).toBeNull();
  });
});

describe('GET /foods/ids (BE-1)', () => {
  it('returns every id the same filter selects, past the first page', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    for (let i = 0; i < 60; i += 1) await seedFood(userId, `Aliment ${String(i).padStart(2, '0')}`);

    const page = await agent.get('/api/v1/foods').query({ limit: 50 });
    expect(page.body.data).toHaveLength(50); // the list only ever shows a page…
    const res = await agent.get('/api/v1/foods/ids');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(60); // …the id set is the whole match.
    expect(new Set(res.body.data as string[]).size).toBe(60);
    expect(csrf).toBeTruthy();
  });

  it('honours every filter, and excludes archived foods unless asked', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);
    await csrfPost(agent, csrf, `/api/v1/foods/${ids[0] as string}/archive`, {});
    await patch(agent, csrf, { ids: [ids[1] as string], patch: { rating: 3 } });

    expect((await agent.get('/api/v1/foods/ids')).body.data).toHaveLength(2);
    expect(
      (await agent.get('/api/v1/foods/ids').query({ include_archived: true })).body.data,
    ).toHaveLength(3);
    expect((await agent.get('/api/v1/foods/ids').query({ min_rating: 3 })).body.data).toEqual([
      ids[1],
    ]);
    expect((await agent.get('/api/v1/foods/ids').query({ q: 'cabil' })).body.data).toEqual([
      ids[2],
    ]);
    expect((await agent.get('/api/v1/foods/ids').query({ source: 'ciqual' })).body.data).toEqual(
      [],
    );
  });

  it('never offers a recipe-derived food, which the Aliments list does not show either', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Farine');
    await csrfPost(agent, csrf, '/api/v1/recipes', {
      name: 'Pain',
      servings: 2,
      total_batch_grams: 500,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    const res = await agent.get('/api/v1/foods/ids');
    expect(res.body.data).toEqual([flour.id]);
  });
});

describe('POST /foods/bulk/undo (BE-1)', () => {
  it('puts the previous values back, then refuses a second call', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);

    await patch(agent, csrf, { ids, patch: { rating: 3, comment: null, visibility: 'shared' } });
    const undo = await csrfPost(agent, csrf, '/api/v1/foods/bulk/undo', {});
    expect(undo.status).toBe(200);
    expect(undo.body.restored).toBe(3);

    const list = await agent.get('/api/v1/foods');
    for (const food of list.body.data) {
      expect(food).toMatchObject({ rating: 1, visibility: 'private' });
      expect(food.comment).toBe(`note sur ${food.name as string}`);
    }

    // Single-level: the slot was consumed.
    const again = await csrfPost(agent, csrf, '/api/v1/foods/bulk/undo', {});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('nothing_to_undo');
  });

  it('is refused when no batch was ever run', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const res = await csrfPost(agent, csrf, '/api/v1/foods/bulk/undo', {});
    expect(res.status).toBe(409);
  });

  it('only ever undoes the LAST batch — the slot is overwritten, not stacked', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf);

    await patch(agent, csrf, { ids, patch: { rating: 2 } });
    await patch(agent, csrf, { ids, patch: { rating: 3 } });
    await csrfPost(agent, csrf, '/api/v1/foods/bulk/undo', {});

    const list = await agent.get('/api/v1/foods');
    for (const food of list.body.data) expect(food.rating).toBe(2); // not 1
  });
});
