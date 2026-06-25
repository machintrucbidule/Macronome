import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedFood, seedTarget, seedWeight } from './helpers.js';

// Integration contract checks for M7a (spec/api §Settings, days-meals-leftover §pin/unpin;
// spec/logic/pantry-pin.md). Settings round-trip, meal-template CRUD, pantry dedup + live
// pin derivation + pin/unpin cascades (B-045), container CRUD with the locked built-in +
// history safety, and tenancy 404.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2026-03-01';
const FUTURE_A = '2026-12-01';
const FUTURE_B = '2026-12-02';
const FUTURE_C = '2026-12-03';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('settings — round-trip + partial merge', () => {
  it('returns defaults, persists a partial patch, and preserves untouched keys', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const initial = await agent.get('/api/v1/settings');
    expect(initial.status).toBe(200);
    expect(initial.body.data).toEqual({
      locale: 'fr',
      theme: 'dark',
      ai: null,
      current_mode: null,
      open_period_note: null,
    });

    const patched = await csrfPatch(agent, csrf, '/api/v1/settings', {
      theme: 'light',
      current_mode: 'not_in_diet',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.theme).toBe('light');
    expect(patched.body.data.current_mode).toBe('not_in_diet');

    // A second, unrelated patch must not clobber the previously stored keys.
    const localeOnly = await csrfPatch(agent, csrf, '/api/v1/settings', { locale: 'en' });
    expect(localeOnly.body.data.locale).toBe('en');
    expect(localeOnly.body.data.theme).toBe('light');
    expect(localeOnly.body.data.current_mode).toBe('not_in_diet');
  });

  it('persists current_mode so the Weight view reports it (Maintien gate)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await csrfPatch(agent, csrf, '/api/v1/settings', { current_mode: 'not_in_diet' });
    const weight = await agent.get('/api/v1/weight');
    expect(weight.body.current_mode).toBe('not_in_diet');
  });
});

describe('meal-template — seeded defaults + CRUD', () => {
  it('seeds the default day structure and supports create/rename/delete', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const seeded = await agent.get('/api/v1/meal-template');
    expect(seeded.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Petit déjeuner',
      'Déjeuner',
      'Dîner',
      'Collation',
    ]);

    const created = await csrfPost(agent, csrf, '/api/v1/meal-template', { name: 'Encas' });
    expect(created.status).toBe(201);
    expect(created.body.data.order_index).toBe(4);

    const renamed = await csrfPatch(agent, csrf, `/api/v1/meal-template/${created.body.data.id}`, {
      name: 'Goûter',
    });
    expect(renamed.body.data.name).toBe('Goûter');

    const del = await agent
      .delete(`/api/v1/meal-template/${created.body.data.id}`)
      .set('x-csrf-token', csrf);
    expect(del.status).toBe(204);
  });
});

describe('pantry — dedup + 📌 idempotency', () => {
  it('rejects a duplicate pin per (slot, food) with 409 pantry_duplicate', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Flocons');

    const first = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });
    expect(first.status).toBe(201);

    const dup = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('pantry_duplicate');
  });

  it('pre-fills a new day at qty 0 and the 📌 toggle is idempotent', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Flocons');
    await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });

    // GET a never-touched future day → unsaved scaffold with the pantry preview line.
    const scaffold = await agent.get(`/api/v1/days/${FUTURE_A}`);
    const breakfast = scaffold.body.meals.find(
      (m: { slot_name: string }) => m.slot_name === 'Petit déjeuner',
    );
    expect(breakfast.entries).toHaveLength(1);
    expect(breakfast.entries[0]).toMatchObject({
      id: '',
      food_id: food.id,
      served_quantity: 0,
      is_pinned: true,
    });

    // Materialize that day → the prefill becomes a real qty-0 line.
    const materialized = await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`);
    const realBreakfast = materialized.body.meals.find(
      (m: { slot_name: string }) => m.slot_name === 'Petit déjeuner',
    );
    expect(realBreakfast.entries).toHaveLength(1);
    const entryId = realBreakfast.entries[0].id as string;
    const mealId = realBreakfast.id as string;

    // The 📌 toggle is idempotent — pinning the same line again keeps one pantry row.
    const pinAgain = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${entryId}/pin`);
    expect(pinAgain.status).toBe(200);
    expect(pinAgain.body.is_pinned).toBe(true);
    const pantry = await agent.get('/api/v1/pantry');
    expect(pantry.body.data).toHaveLength(1);
  });
});

describe('pantry — pin/unpin cascades (B-045)', () => {
  it('unpin cascade — drops qty-0 lines everywhere, keeps logged lines without the pin icon', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Flocons');
    const pin = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });
    const breakfastOf = (body: {
      meals: { slot_name: string; id: string; entries: unknown[] }[];
    }) => body.meals.find((m) => m.slot_name === 'Petit déjeuner')!;

    // Day A: prefilled, then logged at qty 200 → must survive the unpin.
    const matA = await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`);
    const bA = breakfastOf(matA.body) as { id: string; entries: { id: string }[] };
    await csrfPatch(agent, csrf, `/api/v1/meals/${bA.id}/entries/${bA.entries[0]!.id}`, {
      served_quantity: 200,
    });

    // Day B: prefilled, left at qty 0 → must be dropped by the unpin.
    await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_B}`);

    // Unpin from settings → cascade runs across all days.
    const del = await agent.delete(`/api/v1/pantry/${pin.body.data.id}`).set('x-csrf-token', csrf);
    expect(del.status).toBe(204);

    // Day A keeps the logged line, now without the derived pin icon.
    const bAfterA = breakfastOf((await agent.get(`/api/v1/days/${FUTURE_A}`)).body);
    expect(bAfterA.entries).toHaveLength(1);
    expect(bAfterA.entries[0]).toMatchObject({ served_quantity: 200, is_pinned: false });

    // Day B's qty-0 line is gone, and a brand-new day no longer pre-fills it.
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE_B}`)).body).entries).toHaveLength(0);
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE_C}`)).body).entries).toHaveLength(0);
  });

  it('pin cascade (Option C) — adds a qty-0 line to today + future days, never to past days', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Flocons');
    const breakfastOf = (body: { meals: { slot_name: string; entries: unknown[] }[] }) =>
      body.meals.find((m) => m.slot_name === 'Petit déjeuner')!;

    // Three existing days, no pin yet → breakfast is empty on all of them.
    await csrfPost(agent, csrf, `/api/v1/days/${PAST}`);
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`);

    // Pin the food from settings.
    await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });

    // Past is untouched; today + future gained the live qty-0 pin line.
    expect(breakfastOf((await agent.get(`/api/v1/days/${PAST}`)).body).entries).toHaveLength(0);
    const today = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(today.entries).toHaveLength(1);
    expect(today.entries[0]).toMatchObject({
      food_id: food.id,
      served_quantity: 0,
      is_pinned: true,
    });
    const future = breakfastOf((await agent.get(`/api/v1/days/${FUTURE_A}`)).body);
    expect(future.entries).toHaveLength(1);
    expect(future.entries[0]).toMatchObject({ food_id: food.id, is_pinned: true });
  });
});

describe('containers — built-in lock, CRUD, history safety', () => {
  it('exposes a locked built-in "Rien" that rejects edit and delete', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const list = await agent.get('/api/v1/containers');
    const rien = list.body.data.find((c: { is_builtin: boolean }) => c.is_builtin);
    expect(rien).toMatchObject({ name: 'Rien', empty_weight_g: 0, is_builtin: true });

    const edit = await csrfPatch(agent, csrf, `/api/v1/containers/${rien.id}`, { name: 'X' });
    expect(edit.status).toBe(403);
    const del = await agent.delete(`/api/v1/containers/${rien.id}`).set('x-csrf-token', csrf);
    expect(del.status).toBe(403);
  });

  it('supports CRUD with a 409 on a duplicate name', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const created = await csrfPost(agent, csrf, '/api/v1/containers', {
      name: 'Bol bleu',
      empty_weight_g: 250,
    });
    expect(created.status).toBe(201);

    const dup = await csrfPost(agent, csrf, '/api/v1/containers', {
      name: 'bol  bleu',
      empty_weight_g: 100,
    });
    expect(dup.status).toBe(409);

    const del = await agent
      .delete(`/api/v1/containers/${created.body.data.id}`)
      .set('x-csrf-token', csrf);
    expect(del.status).toBe(204);
  });

  it('deleting a container leaves frozen leftover history intact (Gap 13)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    const food = await seedFood(userId, 'Riz');
    const container = await csrfPost(agent, csrf, '/api/v1/containers', {
      name: 'Saladier',
      empty_weight_g: 300,
    });

    const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const mealId = day.body.meals[0].id as string;
    const entry = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: food.id,
      served_quantity: 400,
      unit: 'g',
    });
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.body.data.id,
      gross_grams: 400, // 400 − 300 tare = 100 net
      entry_ids: [entry.body.id],
    });

    // Free delete of the catalog row…
    const del = await agent
      .delete(`/api/v1/containers/${container.body.data.id}`)
      .set('x-csrf-token', csrf);
    expect(del.status).toBe(204);

    // …history froze name + tare as a value, so the leftover is unchanged.
    const reread = await agent.get(`/api/v1/days/${TODAY}`);
    const group = reread.body.meals[0].leftover_groups[0];
    expect(group).toMatchObject({
      container_name: 'Saladier',
      tare_g: 300,
      leftover_net_grams: 100,
    });
  });
});

describe('settings & pantry — tenancy', () => {
  it("returns 404 on another user's template / pantry / container", async () => {
    const alice = await authedAgent(app, 'alice');
    const food = await seedFood(alice.userId, 'Flocons');
    const tmpl = (await alice.agent.get('/api/v1/meal-template')).body.data[0];
    const pin = await csrfPost(alice.agent, alice.csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });
    const container = await csrfPost(alice.agent, alice.csrf, '/api/v1/containers', {
      name: 'Bol',
      empty_weight_g: 100,
    });

    const bob = await authedAgent(app, 'bob');
    const tmplDel = await bob.agent
      .delete(`/api/v1/meal-template/${tmpl.id}`)
      .set('x-csrf-token', bob.csrf);
    expect(tmplDel.status).toBe(404);
    const pantryDel = await bob.agent
      .delete(`/api/v1/pantry/${pin.body.data.id}`)
      .set('x-csrf-token', bob.csrf);
    expect(pantryDel.status).toBe(404);
    const containerEdit = await csrfPatch(
      bob.agent,
      bob.csrf,
      `/api/v1/containers/${container.body.data.id}`,
      { name: 'Hijack' },
    );
    expect(containerEdit.status).toBe(404);
  });
});
