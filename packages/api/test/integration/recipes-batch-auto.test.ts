import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, seedFood, type Agent } from './helpers.js';

// RW-1 / B-137 — persisted auto batch weight (spec/api/foods-recipes.md §Recipes,
// spec/logic/recipes-derived-food.md §3): auto ⇒ the server keeps total_batch_grams = Σ
// ingredient grams on every save and parent-cascade rebuild; manual ⇒ the stored cooked
// weight is frozen until edited. Split from recipes.test.ts (300-line cap).
const app = createApp();

function createRecipe(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/recipes').set('x-csrf-token', csrf).send(body);
}

const ing = (id: string, quantity: number, order = 0) => ({
  ref_type: 'food',
  ref_id: id,
  quantity,
  unit: 'g',
  order_index: order,
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recipes — auto batch weight (RW-1 / B-137)', () => {
  it('defaults to auto without an explicit weight and re-tracks Σ on an ingredient edit', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    const sugar = await seedFood(userId, 'Sugar', { kcal: 100, fat: 0, carb: 25, protein: 0 });

    const auto = await createRecipe(agent, csrf, {
      name: 'Auto bake',
      servings: 1,
      ingredients: [ing(flour.id, 100), ing(sugar.id, 100, 1)],
    });
    expect(auto.status).toBe(201);
    expect(auto.body.data.batch_weight_auto).toBe(true);
    expect(auto.body.data.total_batch_grams).toBe(200);

    // Editing the ingredients re-tracks the sum with no manual action (the B-137 bug).
    const autoId = auto.body.data.id as string;
    const retracked = await csrfPatch(agent, csrf, `/api/v1/recipes/${autoId}`, {
      ingredients: [ing(flour.id, 150)],
    });
    expect(retracked.body.data.batch_weight_auto).toBe(true);
    expect(retracked.body.data.total_batch_grams).toBe(150);
  });

  it('rejects auto + an explicit weight together (422)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');
    const res = await createRecipe(agent, csrf, {
      name: 'Conflicting',
      servings: 1,
      batch_weight_auto: true,
      total_batch_grams: 500,
      ingredients: [ing(flour.id, 100)],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toHaveProperty('total_batch_grams');
  });
});

describe('recipes — manual batch weight (RW-1 / B-137)', () => {
  it('manual keeps its cooked weight across edits, round-trips, and re-tracks when flipped to auto', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');

    // Explicit weight → manual; an ingredient edit keeps the stored cooked weight.
    const manual = await createRecipe(agent, csrf, {
      name: 'Manual bake',
      servings: 1,
      total_batch_grams: 900,
      ingredients: [ing(flour.id, 100)],
    });
    expect(manual.body.data.batch_weight_auto).toBe(false);
    expect(manual.body.data.total_batch_grams).toBe(900);
    const manualId = manual.body.data.id as string;
    const kept = await csrfPatch(agent, csrf, `/api/v1/recipes/${manualId}`, {
      ingredients: [ing(flour.id, 300)],
    });
    expect(kept.body.data.batch_weight_auto).toBe(false);
    expect(kept.body.data.total_batch_grams).toBe(900);

    // Round-trip: the persisted flag survives a reload (full + list row).
    const got = await agent.get(`/api/v1/recipes/${manualId}`);
    expect(got.body.data.batch_weight_auto).toBe(false);
    const list = await agent.get('/api/v1/recipes');
    expect(list.body.data[0].batch_weight_auto).toBe(false);

    // Flipping auto back on re-resolves the weight to Σ.
    const flipped = await csrfPatch(agent, csrf, `/api/v1/recipes/${manualId}`, {
      batch_weight_auto: true,
    });
    expect(flipped.body.data.batch_weight_auto).toBe(true);
    expect(flipped.body.data.total_batch_grams).toBe(300);
  });
});

describe('recipes — auto batch weight cascade (RW-1 / B-137)', () => {
  it('refreshes an auto parent batch when a nested-recipe edit cascades', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const flour = await seedFood(userId, 'Flour');

    // Child: 100 g flour, 1 serving, auto → batch 100, auto "portion" = 100 g.
    const child = await createRecipe(agent, csrf, {
      name: 'Base',
      servings: 1,
      ingredients: [ing(flour.id, 100)],
    });
    const childId = child.body.data.id as string;
    const childFood = await agent.get(`/api/v1/foods/${child.body.data.derived_food_id}`);
    const portionId = childFood.body.data.named_portions[0].id as string;

    // Auto parent: 1 portion of the child → Σ = 100 g.
    const parent = await createRecipe(agent, csrf, {
      name: 'Cake',
      servings: 1,
      ingredients: [
        {
          ref_type: 'recipe',
          ref_id: childId,
          quantity: 1,
          unit: 'portion',
          portion_id: portionId,
          order_index: 0,
        },
      ],
    });
    expect(parent.body.data.total_batch_grams).toBe(100);
    const parentId = parent.body.data.id as string;

    // Concentrate the child (cooked weight 50 g) → its auto "portion" becomes 50 g; the
    // cascade re-tracks the auto parent's batch to the new Σ.
    await csrfPatch(agent, csrf, `/api/v1/recipes/${childId}`, { total_batch_grams: 50 });
    const reread = await agent.get(`/api/v1/recipes/${parentId}`);
    expect(reread.body.data.batch_weight_auto).toBe(true);
    expect(reread.body.data.total_batch_grams).toBe(50);
  });
});
