import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedTarget, seedWeight, type Agent } from './helpers.js';

// Integration checks for the target-history resource (TH-1 / B-091; spec/api/weight-
// targets-stats-settings.md §Targets + spec/logic/day-snapshot-verdict.md §3). Runs against
// the compose.test.yml Postgres.
const app = createApp();

/** Seed a target version, returning its id (helpers.seedTarget returns the row). */
async function seedVersion(
  userId: string,
  effectiveFrom: string,
  calMin: number,
  calMax: number,
): Promise<string> {
  const row = (await seedTarget(userId, effectiveFrom, calMin, calMax)) as { id: string };
  return row.id;
}

/** A logged summary day (kcal known directly), with an optional override + frozen snapshot. */
function seedSummaryDay(
  userId: string,
  date: string,
  summaryKcal: number,
  opts: {
    override?: 'OK' | 'NOK' | null;
    verdictAuto?: 'OK' | 'NOK' | null;
    snapshot?: { cal_min: number; cal_max: number };
  } = {},
) {
  return prisma.dayLog.create({
    data: {
      userId,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: 'summary',
      summaryKcal,
      activityLevel: 'sedentary',
      verdictOverride: opts.override ?? null,
      verdictAuto: opts.verdictAuto ?? null,
      targetSnapshot: opts.snapshot ?? { cal_min: 1500, cal_max: 2100 },
    },
  });
}

function dayRow(userId: string, date: string) {
  return prisma.dayLog.findFirst({ where: { userId, date: new Date(`${date}T00:00:00.000Z`) } });
}

function recompute(agent: Agent, csrf: string, id: string, body?: Record<string, unknown>) {
  return csrfPost(agent, csrf, `/api/v1/targets/${id}/recompute`, body);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('target history — list & DTO id', () => {
  it('GET /target exposes the row id', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedVersion(userId, '2026-01-01', 1500, 2100);
    const res = await agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(typeof res.body.target.id).toBe('string');
  });

  it('GET /targets lists versions newest-first with computed period end', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedVersion(userId, '2026-01-01', 1500, 1800);
    await seedVersion(userId, '2026-03-01', 1500, 2500);
    const res = await agent.get('/api/v1/targets');
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].effective_from).toBe('2026-03-01');
    expect(res.body.versions[0].until).toBeNull(); // current version
    expect(res.body.versions[1].effective_from).toBe('2026-01-01');
    expect(res.body.versions[1].until).toBe('2026-02-28'); // day before the next version
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/targets');
    expect(res.status).toBe(401);
  });
});

describe('target history — PATCH / DELETE', () => {
  it('PATCH edits a version in place (no new today row)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const id = await seedVersion(userId, '2026-01-01', 1500, 1800);
    const res = await csrfPatch(agent, csrf, `/api/v1/targets/${id}`, { calorie_max: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.calorie_max).toBe(2000);
    expect(await prisma.target.count({ where: { userId } })).toBe(1); // edited, not added
  });

  it('PATCH a cross-tenant id → 404', async () => {
    const alice = await authedAgent(app, 'alice');
    const id = await seedVersion(alice.userId, '2026-01-01', 1500, 1800);
    const bob = await authedAgent(app, 'bob');
    const res = await csrfPatch(bob.agent, bob.csrf, `/api/v1/targets/${id}`, {
      calorie_max: 2000,
    });
    expect(res.status).toBe(404);
  });

  it('PATCH onto another version date → 409 target_date_occupied', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const v1 = await seedVersion(userId, '2026-01-01', 1500, 1800);
    const v2 = await seedVersion(userId, '2026-03-01', 1500, 2500);
    const res = await csrfPatch(agent, csrf, `/api/v1/targets/${v2}`, {
      effective_from: '2026-01-01',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('target_date_occupied');
    expect(res.body.error.details.existing_id).toBe(v1);
  });

  it('PATCH breaking merged calorie_max ≥ min → 422', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const id = await seedVersion(userId, '2026-01-01', 1500, 1800);
    const res = await csrfPatch(agent, csrf, `/api/v1/targets/${id}`, { calorie_max: 1400 });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('calorie_max');
  });

  it('DELETE removes a version (204), then 404', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const id = await seedVersion(userId, '2026-01-01', 1500, 1800);
    const del = await agent.delete(`/api/v1/targets/${id}`).set('x-csrf-token', csrf);
    expect(del.status).toBe(204);
    expect(await prisma.target.count({ where: { userId } })).toBe(0);
    const again = await agent.delete(`/api/v1/targets/${id}`).set('x-csrf-token', csrf);
    expect(again.status).toBe(404);
  });
});

describe('target history — opt-in recompute (day-snapshot-verdict.md §3)', () => {
  it('recomputes only logged auto days in window; skips overrides + out-of-window; reaches pre-effective days (VR-1)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const v1 = await seedVersion(userId, '2026-01-01', 1500, 1800);
    await seedVersion(userId, '2026-03-01', 1500, 2500); // V2 bounds V1's window at 2026-02-28
    // Retroactive (before V1), in-window auto, in-window forced, out-of-window.
    await seedSummaryDay(userId, '2025-12-15', 1600); // → OK under V1 (1500–1800)
    await seedSummaryDay(userId, '2026-02-15', 2000); // → NOK under V1 (2000 > 1800)
    await seedSummaryDay(userId, '2026-02-20', 1700, { override: 'OK', verdictAuto: 'OK' }); // forced
    await seedSummaryDay(userId, '2026-04-01', 2000, {
      snapshot: { cal_min: 1500, cal_max: 2500 },
    }); // V2

    const count = await agent.get(`/api/v1/targets/${v1}/recompute-count`);
    expect(count.status).toBe(200);
    expect(count.body.count).toBe(2); // the two in-window auto days (forced + out-of-window excluded)

    const res = await recompute(agent, csrf, v1);
    expect(res.status).toBe(200);
    expect(res.body.recomputed).toBe(2);

    const d = await dayRow(userId, '2025-12-15');
    expect(d?.verdictAuto).toBe('OK');
    expect((d?.targetSnapshot as { cal_max: number }).cal_max).toBe(1800); // re-frozen to V1

    const a = await dayRow(userId, '2026-02-15');
    expect(a?.verdictAuto).toBe('NOK');
    expect((a?.targetSnapshot as { cal_max: number }).cal_max).toBe(1800);

    const b = await dayRow(userId, '2026-02-20');
    expect(b?.verdictOverride).toBe('OK'); // forced day untouched
    expect((b?.targetSnapshot as { cal_max: number }).cal_max).toBe(2100); // snapshot unchanged

    const c = await dayRow(userId, '2026-04-01');
    expect((c?.targetSnapshot as { cal_max: number }).cal_max).toBe(2500); // out-of-window untouched
  });

  it('recompute with no logged days in the window → 0', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const id = await seedVersion(userId, '2026-01-01', 1500, 1800);
    const res = await recompute(agent, csrf, id);
    expect(res.status).toBe(200);
    expect(res.body.recomputed).toBe(0);
  });

  it('recompute 404 for an unknown id', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const res = await recompute(agent, csrf, '00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('target preview — engine as of a date', () => {
  it('resolves weight as of effective_from, else today', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedWeight(userId, '2026-01-01', 80);
    await seedWeight(userId, '2026-05-01', 90);
    const draft = {
      calorie_min: 1500,
      calorie_max: 2100,
      protein_g_per_kg: 1.8,
      fat_g_per_kg: 0.8,
    };

    const asOf = await csrfPost(agent, csrf, '/api/v1/target/preview', {
      ...draft,
      effective_from: '2026-02-01',
    });
    expect(asOf.status).toBe(200);
    expect(asOf.body.engine.current_weight_kg).toBe(80); // latest weigh-in ≤ 2026-02-01

    const today = await csrfPost(agent, csrf, '/api/v1/target/preview', draft);
    expect(today.body.engine.current_weight_kg).toBe(90); // latest weigh-in overall
  });
});
