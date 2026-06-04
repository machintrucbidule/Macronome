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
