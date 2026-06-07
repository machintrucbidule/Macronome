import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedFood, seedTarget } from './helpers.js';

// GM-2 (B-092/093/094) — the garde-manger pin remembers a prefill unit (spec/logic/pantry-pin.md
// §3, spec/schema/tables-logging.md → pantry_item.unit/portion_id). New-day prefill, the pin
// cascade, clear-the-day and the unit cascade (Paramètres PATCH + line-driven re-sync) all use
// the stored unit; quantity & grams stay 0 so history is never touched.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2026-03-01';
const FUTURE_A = '2026-12-01';
const FUTURE_B = '2026-12-02';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

function seedPortion(foodId: string, label: string, grams: number): Promise<{ id: string }> {
  return prisma.foodPortion.create({ data: { foodId, label, grams }, select: { id: true } });
}

const breakfastOf = (body: {
  meals: { slot_name: string; id: string; entries: Record<string, unknown>[] }[];
}) => body.meals.find((m) => m.slot_name === 'Petit déjeuner')!;

describe('GM-2 — prefill unit on the pin', () => {
  it("pins with unit='portion' → new-day prefill carries the unit (qty 0, grams 0)", async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Œuf');
    const portion = await seedPortion(food.id, 'œuf', 57);

    const pin = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
      unit: 'portion',
      portion_id: portion.id,
    });
    expect(pin.status).toBe(201);
    expect(pin.body.data).toMatchObject({ unit: 'portion', portion_id: portion.id });

    // GET scaffold preview carries the unit.
    const scaffold = await agent.get(`/api/v1/days/${FUTURE_A}`);
    expect(breakfastOf(scaffold.body).entries[0]).toMatchObject({
      food_id: food.id,
      served_quantity: 0,
      unit: 'portion',
      portion_id: portion.id,
      served_grams: 0,
    });

    // Materialized line carries the unit too.
    const mat = await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`);
    expect(breakfastOf(mat.body).entries[0]).toMatchObject({
      unit: 'portion',
      portion_id: portion.id,
      served_quantity: 0,
      served_grams: 0,
    });
  });

  it('defaults to g when no unit is given, and rejects an invalid portion with 422', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Flocons');

    const created = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });
    expect(created.body.data).toMatchObject({ unit: 'g', portion_id: null });

    const other = await seedFood(userId, 'Riz');
    const stray = await seedPortion(other.id, 'bol', 150); // a portion of a DIFFERENT food
    const bad = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Déjeuner',
      food_id: food.id,
      unit: 'portion',
      portion_id: stray.id,
    });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details).toMatchObject({ portion_id: 'invalid_portion' });
  });

  it('pinning from a non-g meal line captures that line unit (B-093)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Lait');

    const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const mealId = breakfastOf(day.body).id;
    const entry = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: food.id,
      served_quantity: 250,
      unit: 'ml',
    });
    const pin = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${entry.body.id}/pin`);
    expect(pin.status).toBe(200);

    const pantry = await agent.get('/api/v1/pantry');
    expect(pantry.body.data).toHaveLength(1);
    expect(pantry.body.data[0]).toMatchObject({ unit: 'ml', portion_id: null });
  });
});

describe('GM-2 — unit cascade (today + future, past + filled untouched)', () => {
  it('PATCH /pantry/:id re-units today + future qty-0 lines only', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Flocons');
    const pin = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });

    // Materialize past + today + a future day (each prefills the qty-0 'g' line).
    const matPast = await csrfPost(agent, csrf, `/api/v1/days/${PAST}`);
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const matFuture = await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`);

    // Fill the FUTURE_A line (qty > 0) → it must keep its unit through the cascade.
    const fb = breakfastOf(matFuture.body);
    await csrfPatch(agent, csrf, `/api/v1/meals/${fb.id}/entries/${fb.entries[0]!.id as string}`, {
      served_quantity: 100,
    });

    // Change the pin's prefill unit.
    const patched = await csrfPatch(agent, csrf, `/api/v1/pantry/${pin.body.data.id}`, {
      unit: 'kg',
      portion_id: null,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ unit: 'kg' });

    // Today's qty-0 line cascaded to kg; the past line and the filled future line are untouched.
    expect(breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body).entries[0]).toMatchObject({
      served_quantity: 0,
      unit: 'kg',
    });
    expect(breakfastOf((await agent.get(`/api/v1/days/${PAST}`)).body).entries[0]).toMatchObject({
      unit: 'g',
    });
    void matPast;
    expect(
      breakfastOf((await agent.get(`/api/v1/days/${FUTURE_A}`)).body).entries[0],
    ).toMatchObject({
      served_quantity: 100,
      unit: 'g',
    });
    // A brand-new future day now prefills kg.
    expect(
      breakfastOf((await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_B}`)).body).entries[0],
    ).toMatchObject({ unit: 'kg', served_quantity: 0 });
  });
});

describe('GM-2 — line drives the pin + clear-the-day', () => {
  it('editing a pinned line unit re-syncs the pin + cascades (B-093, line drives the pin)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Œuf');
    const portion = await seedPortion(food.id, 'œuf', 57);
    const pin = await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
    });

    const today = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    await csrfPost(agent, csrf, `/api/v1/days/${FUTURE_A}`); // future qty-0 line to cascade onto
    const tb = breakfastOf(today.body);

    // Edit the (pinned) line's unit to a portion.
    await csrfPatch(agent, csrf, `/api/v1/meals/${tb.id}/entries/${tb.entries[0]!.id as string}`, {
      unit: 'portion',
      portion_id: portion.id,
    });

    // The pin re-synced…
    const pantry = await agent.get('/api/v1/pantry');
    expect(pantry.body.data[0]).toMatchObject({
      id: pin.body.data.id,
      unit: 'portion',
      portion_id: portion.id,
    });
    // …and the future qty-0 placeholder cascaded to the portion unit.
    expect(
      breakfastOf((await agent.get(`/api/v1/days/${FUTURE_A}`)).body).entries[0],
    ).toMatchObject({
      unit: 'portion',
      portion_id: portion.id,
      served_quantity: 0,
    });
  });

  it('clear-the-day resets pinned lines to the pin unit, not g', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Œuf');
    const portion = await seedPortion(food.id, 'œuf', 57);
    await csrfPost(agent, csrf, '/api/v1/pantry', {
      meal_slot_name: 'Petit déjeuner',
      food_id: food.id,
      unit: 'portion',
      portion_id: portion.id,
    });

    const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tb = breakfastOf(day.body);
    // Log the pinned line (qty > 0) so clear has something to reset.
    await csrfPatch(agent, csrf, `/api/v1/meals/${tb.id}/entries/${tb.entries[0]!.id as string}`, {
      served_quantity: 2,
    });

    const cleared = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect(cleared.status).toBe(200);
    expect(breakfastOf(cleared.body).entries[0]).toMatchObject({
      served_quantity: 0,
      unit: 'portion',
      portion_id: portion.id,
      served_grams: 0,
    });
  });
});
