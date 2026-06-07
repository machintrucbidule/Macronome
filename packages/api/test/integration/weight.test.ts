import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, type Agent } from './helpers.js';

// Integration contract checks for the weight resource (spec/api/weight-targets-stats-
// settings.md §Weight, M4 acceptance): the one-per-day rule (409 + existing_id), date-edit
// period re-derivation, tenancy 404, and 422 validation. Runs against compose.test.yml.
const app = createApp();

const weighIn = (date: string, weightKg: number, dietFlag = 'in_diet') => ({
  date,
  weight_kg: weightKg,
  diet_flag: dietFlag,
});

function postWeight(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return csrfPost(agent, csrf, '/api/v1/weight', body);
}

/** Seed a target version carrying a loss rate (kg/week) for the trajectory (B-099). */
function seedRateTarget(userId: string, effectiveFrom: string, rateKgPerWeek: number) {
  return prisma.target.create({
    data: {
      userId,
      calorieMin: 1900,
      calorieMax: 2100,
      proteinGPerKg: 1.8,
      fatGPerKg: 0.8,
      rateKgPerWeek,
      targetWeightKg: null,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
    },
  });
}

function deleteWeight(agent: Agent, csrf: string, id: string) {
  return agent.delete(`/api/v1/weight/${id}`).set('x-csrf-token', csrf);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('weight', () => {
  it('derives EMA, trajectory and a period from two weigh-ins', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await postWeight(agent, csrf, weighIn('2026-01-01', 80));
    const second = await postWeight(agent, csrf, weighIn('2026-01-08', 79));
    expect(second.status).toBe(201);

    const res = await agent.get('/api/v1/weight');
    expect(res.status).toBe(200);
    expect(res.body.weigh_ins).toHaveLength(2);
    expect(res.body.ema).toHaveLength(2);
    expect(res.body.trajectory).toHaveLength(2);
    expect(res.body.periods).toHaveLength(1);
    expect(res.body.periods[0]).toMatchObject({ days: 7, weight_end: 79, delta: -1 });
    expect(res.body.cartouche.current).toBe(79);
    expect(res.body.current_mode).toBe('in_diet');
  });

  it('stitches the trajectory at the per-period target rate, not the current one (B-099)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    // Two target versions: 1.0 kg/week, then 0.25 from 2025-11-01.
    await seedRateTarget(userId, '2025-02-01', 1.0);
    await seedRateTarget(userId, '2025-11-01', 0.25);
    // Three weigh-ins → period 1 ends before the boundary (rate 1.0), period 2 ends after it (0.25).
    await postWeight(agent, csrf, weighIn('2025-10-18', 80));
    await postWeight(agent, csrf, weighIn('2025-10-25', 79)); // period 1: 7 days
    await postWeight(agent, csrf, weighIn('2025-11-08', 78)); // period 2: 14 days

    const res = await agent.get('/api/v1/weight?range=all');
    expect(res.status).toBe(200);
    const traj = res.body.trajectory as { date: string; value: number }[];
    expect(traj).toHaveLength(3);
    const v = traj.map((p) => p.value);
    // anchor 80 → −1.0 (1.0/wk × 7d) → 79.0 → −0.5 (0.25/wk × 14d) → 78.5.
    expect(v[0]!).toBeCloseTo(80.0, 5);
    expect(v[1]!).toBeCloseTo(79.0, 5);
    expect(v[2]!).toBeCloseTo(78.5, 5);
    // The slope changes at the boundary (the bug drew the whole line at the current 0.25/wk).
    const slope1 = (v[1]! - v[0]!) / 7;
    const slope2 = (v[2]! - v[1]!) / 14;
    expect(slope1).toBeCloseTo(-1.0 / 7, 5);
    expect(slope2).toBeCloseTo(-0.25 / 7, 5);
  });

  it('excludes a Σ=0 (comment-only) day from a period average intake (day-model)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await postWeight(agent, csrf, weighIn('2026-01-01', 80));
    await postWeight(agent, csrf, weighIn('2026-01-08', 79)); // period span (01, 08]
    // One genuinely logged day (a typed summary total) and one comment-only red day in the span.
    await csrfPatch(agent, csrf, '/api/v1/days/2026-01-05', { summary_kcal: 2000 });
    await csrfPatch(agent, csrf, '/api/v1/days/2026-01-06', { comment: 'rest day' });

    const res = await agent.get('/api/v1/weight');
    // Only the 2000-kcal day counts; the comment-only day (Σ=0) is not logged → not averaged in.
    expect(res.body.periods[0].avg_intake).toBe(2000);
  });

  it('blocks a second weigh-in on an occupied date → 409 + existing_id', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const first = await postWeight(agent, csrf, weighIn('2026-02-01', 80));
    const existingId = first.body.weigh_ins[0].id as string;

    const clash = await postWeight(agent, csrf, weighIn('2026-02-01', 81));
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('weigh_in_date_occupied');
    expect(clash.body.error.details.existing_id).toBe(existingId);

    // The blocked write left the original untouched (still one weigh-in at 80).
    const after = await agent.get('/api/v1/weight');
    expect(after.body.weigh_ins).toHaveLength(1);
    expect(after.body.weigh_ins[0].weight_kg).toBe(80);
  });

  it('re-derives adjacent periods when a weigh-in date is edited', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await postWeight(agent, csrf, weighIn('2026-03-01', 80));
    const created = await postWeight(agent, csrf, weighIn('2026-03-08', 79));
    const secondId = created.body.weigh_ins.find((w: { date: string }) => w.date === '2026-03-08')
      .id as string;

    const before = await agent.get('/api/v1/weight');
    expect(before.body.periods[0].days).toBe(7);

    const patched = csrfPatch(agent, csrf, `/api/v1/weight/${secondId}`, { date: '2026-03-15' });
    const patchRes = await patched;
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.periods[0]).toMatchObject({ end_date: '2026-03-15', days: 14 });
  });

  it('moving a weigh-in onto another occupied date → 409 + existing_id', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const a = await postWeight(agent, csrf, weighIn('2026-04-01', 80));
    await postWeight(agent, csrf, weighIn('2026-04-08', 79));
    const firstId = a.body.weigh_ins[0].id as string;

    const clash = await csrfPatch(agent, csrf, `/api/v1/weight/${firstId}`, { date: '2026-04-08' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('weigh_in_date_occupied');
  });
});

describe('weight — tenancy & validation', () => {
  it("never touches another user's weigh-in (tenancy → 404)", async () => {
    const alice = await authedAgent(app, 'alice');
    const created = await postWeight(alice.agent, alice.csrf, weighIn('2026-05-01', 80));
    const aliceId = created.body.weigh_ins[0].id as string;

    const bob = await authedAgent(app, 'bob');
    const patch = await csrfPatch(bob.agent, bob.csrf, `/api/v1/weight/${aliceId}`, {
      weight_kg: 70,
    });
    expect(patch.status).toBe(404);
    const del = await deleteWeight(bob.agent, bob.csrf, aliceId);
    expect(del.status).toBe(404);

    // Alice's row is intact and Bob sees an empty history.
    expect((await bob.agent.get('/api/v1/weight')).body.weigh_ins).toHaveLength(0);
    expect((await alice.agent.get('/api/v1/weight')).body.weigh_ins).toHaveLength(1);
  });

  it('rejects a malformed body with 422 + per-field details', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const res = await postWeight(agent, csrf, {
      date: '01-01-2026', // not YYYY-MM-DD
      weight_kg: -5, // not positive
      diet_flag: 'bingeing', // not in the enum
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toHaveProperty('date');
    expect(res.body.error.details).toHaveProperty('weight_kg');
    expect(res.body.error.details).toHaveProperty('diet_flag');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/weight');
    expect(res.status).toBe(401);
  });
});
