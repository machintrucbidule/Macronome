import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfPatch,
  csrfPost,
  seedFood,
  seedTarget,
  seedWeight,
  type Agent,
} from './helpers.js';

// Integration contract checks for recipes (spec/api/foods-recipes.md §Recipes, M5
// acceptance): derived-food (re)build + auto "portion", combined log search, transitive
// cycle 422, forward-only cascade with a frozen past meal_entry, tenancy 404.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

function createRecipe(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/recipes').set('x-csrf-token', csrf).send(body);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recipes — derived food', () => {
  it('builds a derived food + auto "portion" and exposes it in /search/loggable', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const a = await seedFood(userId, 'Flour'); // 200 kcal/100 g default
    const b = await seedFood(userId, 'Sugar', { kcal: 100, fat: 0, carb: 25, protein: 0 });

    const created = await createRecipe(agent, csrf, {
      name: 'Sample bake',
      servings: 2,
      ingredients: [
        { ref_type: 'food', ref_id: a.id, quantity: 100, unit: 'g', order_index: 0 },
        { ref_type: 'food', ref_id: b.id, quantity: 100, unit: 'g', order_index: 1 },
      ],
    });
    expect(created.status).toBe(201);
    const data = created.body.data;
    // totals: 300 kcal over 200 g batch (default) → 150 kcal/100 g; 2 servings → 100 g / 150 kcal.
    expect(data.total_batch_grams).toBe(200);
    expect(data.kcal_per_100g).toBe(150);
    expect(data.weight_per_portion_g).toBe(100);
    expect(data.per_portion.kcal).toBe(150);
    expect(data.ingredients).toHaveLength(2);
    expect(data.ingredients[0]).toMatchObject({ grams: 100, kcal: 200, ref_name: 'Flour' });
    expect(data.derived_food_id).not.toBeNull();

    const loggable = await agent.get('/api/v1/search/loggable').query({ q: 'sample' });
    expect(loggable.status).toBe(200);
    const recipeItem = loggable.body.data.find((i: { kind: string }) => i.kind === 'recipe');
    expect(recipeItem).toBeTruthy();
    expect(recipeItem.named_portions[0]).toMatchObject({ label: 'portion', grams: 100 });
  });
});

describe('recipes — preview (stateless live recompute)', () => {
  it('returns derived figures for an unsaved draft without persisting anything', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const a = await seedFood(userId, 'Flour'); // 200 kcal/100 g default
    const b = await seedFood(userId, 'Sugar', { kcal: 100, fat: 0, carb: 25, protein: 0 });

    const res = await csrfPost(agent, csrf, '/api/v1/recipes/preview', {
      servings: 2,
      ingredients: [
        { ref_type: 'food', ref_id: a.id, quantity: 100, unit: 'g', order_index: 0 },
        { ref_type: 'food', ref_id: b.id, quantity: 100, unit: 'g', order_index: 1 },
      ],
    });

    expect(res.status).toBe(200);
    const data = res.body.data;
    // Same maths as a save: 300 kcal over a 200 g default batch → 150 kcal/100 g; 2 servings.
    expect(data.total_ingredient_grams).toBe(200);
    expect(data.total_batch_grams).toBe(200);
    expect(data.kcal_per_100g).toBe(150);
    expect(data.weight_per_portion_g).toBe(100);
    expect(data.total_macros.kcal).toBe(300);
    expect(data.per_portion.kcal).toBe(150);
    expect(data.ingredients).toHaveLength(2);
    expect(data.ingredients[0]).toMatchObject({ grams: 100, kcal: 200, ref_name: 'Flour' });
    // Preview lines carry no persisted id.
    expect(data.ingredients[0]).not.toHaveProperty('id');

    // Nothing was written.
    expect(await prisma.recipe.count({ where: { ownerId: userId } })).toBe(0);
  });

  it('returns zeroed figures for an empty draft', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const res = await csrfPost(agent, csrf, '/api/v1/recipes/preview', {
      servings: 3,
      ingredients: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total_ingredient_grams: 0,
      total_batch_grams: 0,
      kcal_per_100g: 0,
      servings: 3,
    });
    expect(res.body.data.total_macros.kcal).toBe(0);
    expect(res.body.data.ingredients).toHaveLength(0);
  });

  it("rejects a draft referencing another user's food (user-scoped resolution)", async () => {
    const alice = await authedAgent(app, 'alice');
    const flour = await seedFood(alice.userId, 'Flour');
    const bob = await authedAgent(app, 'bob');

    const res = await csrfPost(bob.agent, bob.csrf, '/api/v1/recipes/preview', {
      servings: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    expect(res.status).toBe(422);
  });
});

describe('recipes — transitive cycle', () => {
  it('rejects an ingredient that would close a cycle (422 would_create_cycle)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');

    const r1 = await createRecipe(agent, csrf, {
      name: 'Base',
      servings: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    const r1Id = r1.body.data.id as string;

    const r2 = await createRecipe(agent, csrf, {
      name: 'Derived',
      servings: 1,
      ingredients: [{ ref_type: 'recipe', ref_id: r1Id, quantity: 100, unit: 'g', order_index: 0 }],
    });
    expect(r2.status).toBe(201);
    const r2Id = r2.body.data.id as string;

    // Making r1 reference r2 closes r1→r2→r1.
    const cyclic = await csrfPatch(agent, csrf, `/api/v1/recipes/${r1Id}`, {
      ingredients: [{ ref_type: 'recipe', ref_id: r2Id, quantity: 100, unit: 'g', order_index: 0 }],
    });
    expect(cyclic.status).toBe(422);
    expect(cyclic.body.error.code).toBe('would_create_cycle');
    expect(cyclic.body.error.details).toHaveProperty('ingredient');
  });
});

describe('recipes — forward-only cascade & frozen history', () => {
  it('cascades a nested edit to the parent derived food while a logged entry stays frozen', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    const flour = await seedFood(userId, 'Flour'); // 200 kcal/100 g

    // r1: 100 g flour, 1 serving → derived 200 kcal/100 g.
    const r1 = await createRecipe(agent, csrf, {
      name: 'Base',
      servings: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    const r1Id = r1.body.data.id as string;

    // r2 references r1 (100 g) → derived 200 kcal/100 g, portion 100 g.
    const r2 = await createRecipe(agent, csrf, {
      name: 'Cake',
      servings: 1,
      ingredients: [{ ref_type: 'recipe', ref_id: r1Id, quantity: 100, unit: 'g', order_index: 0 }],
    });
    const r2Id = r2.body.data.id as string;
    const r2FoodId = r2.body.data.derived_food_id as string;
    const r2Food = await agent.get(`/api/v1/foods/${r2FoodId}`);
    const portionId = r2Food.body.data.named_portions[0].id as string;

    // Log 1 portion of r2's derived food on today → snapshot frozen at 200 kcal.
    const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const mealId = day.body.meals[0].id as string;
    const entry = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: r2FoodId,
      served_quantity: 1,
      unit: 'portion',
      portion_id: portionId,
    });
    expect(entry.body.snap.kcal).toBe(200);

    // Concentrate r1 (batch 50 g) → r1 derived 400 kcal/100 g; cascade rebuilds r2.
    const edit = await csrfPatch(agent, csrf, `/api/v1/recipes/${r1Id}`, { total_batch_grams: 50 });
    expect(edit.status).toBe(200);

    // Cascade persisted: r2's derived food now reflects the change (200 → 400).
    const r2Derived = await prisma.food.findFirst({
      where: { ownerId: userId, source: 'recipe', recipeId: r2Id },
      select: { kcalPer100g: true },
    });
    expect(Number(r2Derived?.kcalPer100g)).toBe(400);

    // The already-logged entry stays frozen at its original snapshot.
    const reread = await agent.get(`/api/v1/days/${TODAY}`);
    expect(reread.body.totals.kcal).toBe(200);
  });
});

describe('recipes — rating (RT-1 / B-080)', () => {
  async function rated(agent: Agent, csrf: string, foodId: string, name: string, rating: unknown) {
    return createRecipe(agent, csrf, {
      name,
      servings: 1,
      ...(rating === undefined ? {} : { rating }),
      ingredients: [{ ref_type: 'food', ref_id: foodId, quantity: 100, unit: 'g', order_index: 0 }],
    });
  }

  it('defaults rating to null, round-trips 0..3 on POST/PATCH, returns it on GET', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');

    const created = await rated(agent, csrf, flour.id, 'Unrated bake', undefined);
    expect(created.status).toBe(201);
    expect(created.body.data.rating).toBeNull();
    const id = created.body.data.id as string;

    const patched = await csrfPatch(agent, csrf, `/api/v1/recipes/${id}`, { rating: 2 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.rating).toBe(2);

    const got = await agent.get(`/api/v1/recipes/${id}`);
    expect(got.body.data.rating).toBe(2);

    // Summary (list) row also carries it.
    const list = await agent.get('/api/v1/recipes');
    expect(list.body.data[0].rating).toBe(2);

    // Bof (0) is a real grade, distinct from unrated.
    const zeroed = await csrfPatch(agent, csrf, `/api/v1/recipes/${id}`, { rating: 0 });
    expect(zeroed.body.data.rating).toBe(0);
  });

  it('rejects an out-of-range rating (422)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    const res = await rated(agent, csrf, flour.id, 'Bad rating', 4);
    expect(res.status).toBe(422);
  });

  it('filters by min_rating (≥1 excludes Bof 0 and unrated)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    await rated(agent, csrf, flour.id, 'R unrated', undefined);
    await rated(agent, csrf, flour.id, 'R zero', 0);
    await rated(agent, csrf, flour.id, 'R one', 1);
    await rated(agent, csrf, flour.id, 'R two', 2);
    await rated(agent, csrf, flour.id, 'R three', 3);

    const r1 = await agent.get('/api/v1/recipes').query({ min_rating: 1 });
    expect(r1.body.data.map((x: { rating: number }) => x.rating).sort()).toEqual([1, 2, 3]);

    const r2 = await agent.get('/api/v1/recipes').query({ min_rating: 2 });
    expect(r2.body.data.map((x: { rating: number }) => x.rating).sort()).toEqual([2, 3]);

    const r3 = await agent.get('/api/v1/recipes').query({ min_rating: 3 });
    expect(r3.body.data.map((x: { rating: number }) => x.rating)).toEqual([3]);
  });

  it('sorts by rating', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    await rated(agent, csrf, flour.id, 'A', 3);
    await rated(agent, csrf, flour.id, 'B', 1);
    await rated(agent, csrf, flour.id, 'C', 2);

    const asc = await agent.get('/api/v1/recipes').query({ sort: 'rating', dir: 'asc' });
    expect(asc.body.data.map((x: { rating: number }) => x.rating)).toEqual([1, 2, 3]);
  });
});

describe('recipes — archived filter (RT-1 / B-081)', () => {
  it('hides archived recipes by default and shows them with include_archived', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    const created = await createRecipe(agent, csrf, {
      name: 'To archive',
      servings: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    const id = created.body.data.id as string;

    const archived = await csrfPost(agent, csrf, `/api/v1/recipes/${id}/archive`);
    expect(archived.status).toBe(200);

    const list = await agent.get('/api/v1/recipes');
    expect(list.body.data).toHaveLength(0);

    const withArchived = await agent.get('/api/v1/recipes').query({ include_archived: 'true' });
    expect(withArchived.body.data).toHaveLength(1);
    expect(withArchived.body.data[0].archived_at).not.toBeNull();

    const restored = await csrfPost(agent, csrf, `/api/v1/recipes/${id}/restore`);
    expect(restored.status).toBe(200);
    const afterRestore = await agent.get('/api/v1/recipes');
    expect(afterRestore.body.data).toHaveLength(1);
  });
});

describe('recipes — tenancy', () => {
  it("returns 404 on another user's recipe", async () => {
    const alice = await authedAgent(app, 'alice');
    const flour = await seedFood(alice.userId, 'Flour');
    const created = await createRecipe(alice.agent, alice.csrf, {
      name: 'Secret',
      servings: 1,
      ingredients: [
        { ref_type: 'food', ref_id: flour.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    const id = created.body.data.id as string;

    const bob = await authedAgent(app, 'bob');
    const res = await bob.agent.get(`/api/v1/recipes/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
