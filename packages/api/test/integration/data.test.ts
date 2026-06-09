import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
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

// Integration checks for the Données export/wipe/import round-trip (IMP-1, spec/api/
// data-export-import.md): export captures everything, wipe keeps the seed, and import REPLACES
// the account with the extract verbatim — frozen snapshots and ids carried across unchanged.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

/** Strip the timestamp and order every array deterministically for a structural compare. */
function norm(env: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(env);
  delete clone.exported_at;
  for (const key of Object.keys(clone)) {
    const value = clone[key];
    if (Array.isArray(value)) {
      value.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    }
  }
  return clone;
}

/** Build a non-trivial account: foods, plus a recipe + its derived food + an ingredient. */
async function seedAccount(userId: string): Promise<void> {
  await seedTarget(userId, '2026-01-01');
  await seedWeight(userId, '2026-01-01', 80);
  const rice = await seedFood(userId, 'Riz');
  const chicken = await seedFood(userId, 'Poulet');
  // B-123 "Dispo IA" flag — a non-default value that must survive the round-trip (anti-omission).
  await prisma.food.update({ where: { id: chicken.id }, data: { aiProposable: false } });

  // A recipe + its derived food (source='recipe') + an ingredient — exercises the FK ordering.
  const recipe = await prisma.recipe.create({
    data: {
      ownerId: userId,
      name: 'Curry',
      normalizedName: 'curry',
      totalBatchGrams: 500,
      servings: 2,
    },
  });
  await prisma.food.create({
    data: {
      ownerId: userId,
      name: 'Curry',
      normalizedName: 'curry',
      kcalPer100g: 150,
      fatPer100g: 5,
      carbPer100g: 20,
      proteinPer100g: 6,
      source: 'recipe',
      recipeId: recipe.id,
    },
  });
  await prisma.recipeIngredient.create({
    data: {
      recipeId: recipe.id,
      refType: 'food',
      refFoodId: rice.id,
      quantity: 200,
      unit: 'g',
      orderIndex: 0,
    },
  });
}

/** Seed the account and log a non-trivial TODAY: a referenced line, a custom line, a pin, a
 *  comment. Returns the referenced entry id (to assert its frozen snapshot survives). */
async function populate(agent: Agent, csrf: string, userId: string): Promise<string> {
  await seedAccount(userId);
  const rice = await prisma.food.findFirst({ where: { ownerId: userId, name: 'Riz' } });
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const meal = day.body.meals[0];
  const mealId = meal.id as string;
  const ricEntry = (
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: rice!.id,
      served_quantity: 500,
      unit: 'g',
    })
  ).body.id as string;
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'custom',
    custom_name: 'Café',
    served_quantity: 0,
    snap: { kcal: 5, fat: 0, carb: 1, protein: 0 },
  });
  await csrfPost(agent, csrf, `/api/v1/pantry`, {
    meal_slot_name: meal.slot_name,
    food_id: rice!.id,
    unit: 'ml', // GM-2 prefill unit — must survive the export/import round-trip
  });
  await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
    comment: 'Concert',
    activity_level: 'lightly_active',
  });
  return ricEntry;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('data export / wipe / import (IMP-1)', () => {
  it('round-trips: export → wipe → import restores an identical snapshot', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const ricEntry = await populate(agent, csrf, userId);

    const before = (await agent.get('/api/v1/data/export')).body as Record<string, unknown>;
    expect(before.format_version).toBe(1);
    expect((before.day_logs as unknown[]).length).toBe(1);
    expect((before.recipes as unknown[]).length).toBe(1);
    // The derived recipe food + the two catalog foods are all present.
    expect((before.foods as unknown[]).length).toBe(3);
    expect(JSON.stringify(before)).not.toContain('password');
    // GM-2 follow-up: the pantry prefill unit is carried in the envelope (not reset to 'g').
    const pantry = before.pantry_items as { unit: string }[];
    expect(pantry).toHaveLength(1);
    expect(pantry[0]!.unit).toBe('ml');
    // Envelope audit: the non-default ai_proposable flag is carried (not reset to true).
    const chickenBefore = (before.foods as { name: string; ai_proposable: boolean }[]).find(
      (f) => f.name === 'Poulet',
    );
    expect(chickenBefore?.ai_proposable).toBe(false);

    const wiped = await csrfPost(agent, csrf, `/api/v1/data/wipe`);
    expect(wiped.status).toBe(200);
    expect(await prisma.food.count({ where: { ownerId: userId } })).toBe(0);
    expect(await prisma.dayLog.count({ where: { userId } })).toBe(0);
    // Seed preserved: the default template + the built-in "Rien" container survive.
    expect(await prisma.mealSlotTemplate.count({ where: { userId } })).toBe(4);
    expect(await prisma.container.count({ where: { ownerId: userId, isBuiltin: true } })).toBe(1);
    expect(await prisma.appUser.count()).toBe(1);

    const imported = await agent.post('/api/v1/data/import').set('x-csrf-token', csrf).send(before);
    expect(imported.status).toBe(200);

    const after = (await agent.get('/api/v1/data/export')).body as Record<string, unknown>;
    expect(norm(after)).toEqual(norm(before));

    // Frozen snapshot carried verbatim onto the restored entry.
    const entry = await prisma.mealEntry.findUnique({ where: { id: ricEntry } });
    expect(entry).not.toBeNull();
    expect(Number(entry!.snapKcal)).toBeGreaterThan(0);

    // GM-2 follow-up: the restored pantry pin keeps its prefill unit (not reset to 'g').
    const pin = await prisma.pantryItem.findFirst({ where: { userId } });
    expect(pin?.unit).toBe('ml');
    // Envelope audit: the restored food keeps ai_proposable=false (not reset to the default true).
    const chicken = await prisma.food.findFirst({ where: { ownerId: userId, name: 'Poulet' } });
    expect(chicken?.aiProposable).toBe(false);
  });

  it('keeps credentials on import (login still works)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01');
    const snapshot = (await agent.get('/api/v1/data/export')).body as Record<string, unknown>;

    await agent.post('/api/v1/data/import').set('x-csrf-token', csrf).send(snapshot);

    const fresh = request.agent(app);
    const pre = await fresh.get('/api/v1/auth/session');
    const token = (pre.headers['set-cookie'] as unknown as string[])
      .map((c) => /macronome\.csrf=([^;]+)/.exec(c)?.[1])
      .find(Boolean) as string;
    const login = await fresh
      .post('/api/v1/auth/login')
      .set('x-csrf-token', decodeURIComponent(token))
      .send({ username: 'bob', password: 'correct-horse' });
    expect(login.status).toBe(200);
  });

  it('rejects an unsupported format version (422) and a malformed body (422)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await seedTarget(userId, '2026-01-01');
    const env = (await agent.get('/api/v1/data/export')).body as Record<string, unknown>;

    const badVersion = await agent
      .post('/api/v1/data/import')
      .set('x-csrf-token', csrf)
      .send({ ...env, format_version: 999 });
    expect(badVersion.status).toBe(422);
    expect(badVersion.body.error.code).toBe('import_unsupported_version');

    const malformed = await agent
      .post('/api/v1/data/import')
      .set('x-csrf-token', csrf)
      .send({ nonsense: true });
    expect(malformed.status).toBe(422);
    expect(malformed.body.error.code).toBe('import_invalid_format');
  });
});
