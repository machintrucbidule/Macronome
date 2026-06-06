import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedFood, seedTarget, seedWeight } from './helpers.js';

// Integration contract checks for the daily log (spec/api/days-meals-leftover.md, M3
// acceptance): entry flow → totals + verdict, override/activity, tenancy 404, and the
// frozen-past snapshot stability. Runs against the compose.test.yml Postgres.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('daily log — entry flow', () => {
  it('adds a referenced line → day totals + calorie verdict update', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01'); // 1900–2100
    await seedWeight(userId, '2026-01-01', 80);
    const food = await seedFood(userId, 'Riz'); // 200 kcal / 100 g

    const created = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    expect(created.status).toBe(201);
    const mealId = created.body.meals[0].id as string;

    const entry = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: food.id,
      served_quantity: 250,
      unit: 'g',
    });
    expect(entry.status).toBe(201);
    expect(entry.body.served_grams).toBe(250);
    expect(entry.body.snap.kcal).toBe(500);
    expect(entry.body.consumed.kcal).toBe(500);

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.totals.kcal).toBe(500);
    expect(day.body.totals.protein).toBe(12.5);
    expect(day.body.verdict_auto).toBe('NOK'); // 500 < 1900 → SOUS
    expect(day.body.effective_verdict).toBe('NOK');
  });

  it('honours a manual override and an activity-driven constat', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);

    const forced = await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      verdict_override: 'OK',
    });
    expect(forced.status).toBe(200);
    expect(forced.body.verdict_auto).toBe('NOK');
    expect(forced.body.effective_verdict).toBe('OK');

    const active = await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      activity_level: 'moderately_active',
    });
    expect(active.body.constat.estimated_burn).toBeGreaterThan(0);
    expect(active.body.constat.deficit).toBeLessThan(0); // intake 0 − burn
  });
});

describe('daily log — default activity & deficit readout (B-033/B-038)', () => {
  it('a never-touched day defaults to sedentary with a computed deficit readout', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);

    const scaffold = await agent.get(`/api/v1/days/${TODAY}`);
    expect(scaffold.status).toBe(200);
    expect(scaffold.body.activity_level).toBe('sedentary'); // never null / "unset"
    expect(scaffold.body.constat.estimated_burn).toBeGreaterThan(0); // computed by default
  });

  it('the readout is null only when the account has no body weight yet', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01'); // no weigh-in

    const scaffold = await agent.get(`/api/v1/days/${TODAY}`);
    expect(scaffold.body.activity_level).toBe('sedentary');
    expect(scaffold.body.constat.estimated_burn).toBeNull(); // placeholder path
  });
});

describe('daily log — per-level activity burn (B-026)', () => {
  it('exposes kcal-from-activity (above BMR) for each of the 5 levels', async () => {
    const { agent, userId } = await authedAgent(app, 'alice'); // 80 kg, 180 cm, male, age 40
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80); // BMR = 1730 → sedentary activity = 1730×0.2

    const day = await agent.get(`/api/v1/days/${TODAY}`);
    const burns = day.body.constat.per_level_activity_burn as Record<string, number>;
    expect(burns.sedentary).toBe(346); // 1730 × 1.2 − 1730, activity only (excludes BMR)
    expect(burns.extremely_active).toBe(1557); // 1730 × 1.9 − 1730
    const ordered = [
      burns.sedentary,
      burns.lightly_active,
      burns.moderately_active,
      burns.very_active,
      burns.extremely_active,
    ] as number[];
    for (let i = 1; i < ordered.length; i++)
      expect(ordered[i] as number).toBeGreaterThan(ordered[i - 1] as number);
  });

  it('is null when the account has no body weight yet', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01'); // no weigh-in
    const day = await agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.constat.per_level_activity_burn).toBeNull();
  });
});

describe('daily log — tenancy', () => {
  it("returns 404 on another user's meal / entry (no cross-tenant access)", async () => {
    const alice = await authedAgent(app, 'alice');
    await seedTarget(alice.userId, '2026-01-01');
    const food = await seedFood(alice.userId, 'Riz');
    const day = await csrfPost(alice.agent, alice.csrf, `/api/v1/days/${TODAY}`);
    const mealId = day.body.meals[0].id as string;
    const entry = await csrfPost(alice.agent, alice.csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'referenced',
      food_id: food.id,
      served_quantity: 100,
      unit: 'g',
    });

    const bob = await authedAgent(app, 'bob');
    const addToAlice = await csrfPost(bob.agent, bob.csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'custom',
      custom_name: 'X',
      snap: { kcal: 1, fat: 0, carb: 0, protein: 0 },
    });
    expect(addToAlice.status).toBe(404);
    const delAlice = await bob.agent
      .delete(`/api/v1/meals/${mealId}/entries/${entry.body.id}`)
      .set('x-csrf-token', bob.csrf);
    expect(delAlice.status).toBe(404);
  });
});

describe('daily log — frozen past', () => {
  it('keeps a past day snapshot stable when a later weigh-in is added', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-05-01');
    await seedWeight(userId, '2026-05-01', 80); // protein floor = 1.8 × 80 = 144

    const created = await csrfPost(agent, csrf, '/api/v1/days/2026-06-01');
    expect(created.body.target_snapshot.protein_floor_g).toBe(144);

    // A weigh-in dated before the day would change a LIVE snapshot (90 → 162)…
    await seedWeight(userId, '2026-05-20', 90);

    const reread = await agent.get('/api/v1/days/2026-06-01');
    // …but the past day is frozen: still 144.
    expect(reread.body.target_snapshot.protein_floor_g).toBe(144);
  });
});
