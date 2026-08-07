import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, type Agent } from './helpers.js';

// BE-1/B-308: the Recettes list gets the same bulk mechanism as Aliments, restricted to the
// rating — `servings` and `total_batch_grams` rebuild the derived food, so they are deliberately
// not bulk-editable (spec/api/foods-recipes.md §Recipes).
const app = createApp();

const patch = (agent: Agent, csrf: string, body: Record<string, unknown>) =>
  agent.patch('/api/v1/recipes/bulk').set('x-csrf-token', csrf).send(body);

async function seedThree(agent: Agent, csrf: string, userId: string): Promise<string[]> {
  const flour = await seedFood(userId, 'Farine');
  const ids: string[] = [];
  for (const name of ['Pain', 'Quiche', 'Ratatouille']) {
    const res = await csrfPost(agent, csrf, '/api/v1/recipes', {
      name,
      servings: 2,
      total_batch_grams: 500,
      rating: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
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

describe('recipes bulk edit (B-308)', () => {
  it('sets the rating on every selected recipe and touches nothing else', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf, userId);

    const res = await patch(agent, csrf, { ids, patch: { rating: 3 } });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);

    const list = await agent.get('/api/v1/recipes');
    for (const recipe of list.body.data) {
      expect(recipe.rating).toBe(3);
      // The derived figures are untouched: the batch never reaches servings or batch weight.
      expect(recipe).toMatchObject({ servings: 2, total_batch_grams: 500, kcal_per_100g: 40 });
    }
  });

  it('rejects any field other than the rating', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf, userId);
    const res = await patch(agent, csrf, { ids, patch: { servings: 4 } });
    expect(res.status).toBe(422); // `servings` is unknown → the patch is empty → empty_patch
  });

  it('resolves the id set through the same filter as the list', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf, userId);
    await csrfPost(agent, csrf, `/api/v1/recipes/${ids[0] as string}/archive`, {});

    expect((await agent.get('/api/v1/recipes/ids')).body.data).toHaveLength(2);
    expect(
      (await agent.get('/api/v1/recipes/ids').query({ include_archived: true })).body.data,
    ).toHaveLength(3);
    expect((await agent.get('/api/v1/recipes/ids').query({ q: 'quic' })).body.data).toEqual([
      ids[1],
    ]);
  });

  it('writes nothing when one id belongs to someone else, and undoes only once', async () => {
    const alice = await authedAgent(app, 'alice');
    const bob = await authedAgent(app, 'bob');
    const mine = await seedThree(alice.agent, alice.csrf, alice.userId);
    const theirs = await seedThree(bob.agent, bob.csrf, bob.userId);

    const refused = await patch(alice.agent, alice.csrf, {
      ids: [...mine, theirs[0] as string],
      patch: { rating: 3 },
    });
    expect(refused.status).toBe(404);
    const untouched = await alice.agent.get('/api/v1/recipes');
    for (const recipe of untouched.body.data) expect(recipe.rating).toBe(1);

    await patch(alice.agent, alice.csrf, { ids: mine, patch: { rating: 0 } });
    const undo = await csrfPost(alice.agent, alice.csrf, '/api/v1/recipes/bulk/undo', {});
    expect(undo.body.restored).toBe(3);
    const back = await alice.agent.get('/api/v1/recipes');
    for (const recipe of back.body.data) expect(recipe.rating).toBe(1);
    expect((await csrfPost(alice.agent, alice.csrf, '/api/v1/recipes/bulk/undo', {})).status).toBe(
      409,
    );
  });

  it('keeps the two undo slots apart — a foods batch does not consume the recipes one', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const ids = await seedThree(agent, csrf, userId);
    await patch(agent, csrf, { ids, patch: { rating: 3 } });

    const food = await seedFood(userId, 'Sel');
    await agent
      .patch('/api/v1/foods/bulk')
      .set('x-csrf-token', csrf)
      .send({ ids: [food.id], patch: { rating: 2 } });
    await csrfPost(agent, csrf, '/api/v1/foods/bulk/undo', {});

    // The recipes slot is still there.
    expect((await csrfPost(agent, csrf, '/api/v1/recipes/bulk/undo', {})).status).toBe(200);
  });
});
