import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, seedTarget } from './helpers.js';

// Integration contract checks for the read-only stats resource (spec/api/weight-targets-
// stats-settings.md §Stats, M6 acceptance): rolling + adherence shapes, summary-day colour,
// tenancy isolation, 422 on a bad year, 401 unauth. Runs against compose.test.yml.
const app = createApp();

const SNAPSHOT = {
  cal_min: 1550,
  cal_max: 1650,
  protein_floor_g: null,
  fat_floor_g: null,
  carb_ceiling_g: null,
};

/** Seed a summary day carrying a calorie value (a logged day for stats). */
function seedSummaryDay(userId: string, date: string, kcal: number): Promise<unknown> {
  const auto = kcal >= SNAPSHOT.cal_min && kcal <= SNAPSHOT.cal_max ? 'OK' : 'NOK';
  return prisma.dayLog.create({
    data: {
      userId,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: 'summary',
      summaryKcal: kcal,
      verdictAuto: auto,
      targetSnapshot: SNAPSHOT,
    },
  });
}

/** A YYYY-MM-DD date offset from today in whole UTC days (matches the service's todayString). */
function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The spec §2 worked window: 28 May–2 Jun 2026; 27 & 31 unlogged.
async function seedWindow7(userId: string): Promise<void> {
  await seedTarget(userId, '2026-01-01', SNAPSHOT.cal_min, SNAPSHOT.cal_max);
  await seedSummaryDay(userId, '2026-05-28', 1600); // OK
  await seedSummaryDay(userId, '2026-05-29', 1700); // NOK (above)
  await seedSummaryDay(userId, '2026-05-30', 1500); // NOK (below)
  await seedSummaryDay(userId, '2026-06-01', 1620); // OK
  await seedSummaryDay(userId, '2026-06-02', 1580); // OK
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('stats — rolling', () => {
  it('averages over logged days as of the latest, OK rate excludes unlogged (§2)', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedWindow7(userId);

    const res = await agent.get('/api/v1/stats/rolling');
    expect(res.status).toBe(200);
    expect(res.body.as_of).toBe('2026-06-02');
    const w7 = res.body.windows.find((w: { window: number }) => w.window === 7);
    expect(w7).toMatchObject({ avg_kcal: 1600, ok_rate: 0.6, vs_target: 'in' });
    expect(res.body.windows.map((w: { window: number }) => w.window)).toEqual([7, 14, 30, 365]);
  });

  it('returns null figures and as_of for a user with no logged days', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/stats/rolling');
    expect(res.status).toBe(200);
    expect(res.body.as_of).toBeNull();
    expect(res.body.windows.every((w: { avg_kcal: null }) => w.avg_kcal === null)).toBe(true);
  });
});

describe('stats — adherence', () => {
  it('returns the documented shape; summary days carry a verdict/colour', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedWindow7(userId);

    const res = await agent.get('/api/v1/stats/adherence?year=2026');
    expect(res.status).toBe(200);
    expect(res.body.heatmap).toHaveLength(365); // 2026 is not a leap year
    expect(res.body.target_zone).toEqual({ cal_min: 1550, cal_max: 1650 });

    const heatmap = res.body.heatmap as { date: string; status: string; kcal: number | null }[];
    const cell = (date: string) => heatmap.find((c) => c.date === date)!;
    expect(cell('2026-05-28').status).toBe('OK');
    expect(cell('2026-05-28').kcal).toBe(1600); // logged cell carries its kcal (tooltip)
    expect(cell('2026-05-29').status).toBe('NOK');
    expect(cell('2026-05-27').status).toBe('none'); // unlogged
    expect(cell('2026-05-27').kcal).toBeNull(); // not-logged → null kcal

    const may = res.body.monthly.find((m: { month: number }) => m.month === 5);
    expect(may).toMatchObject({ ok_count: 1, nok_count: 2 });
    expect(res.body.key.overall_ok_rate).toBe(0.6);
    expect(res.body.key.current_ok_streak).toBe(2); // 06-02 OK, 06-01 OK, then 05-30 NOK breaks
  });
});

describe('stats — future days excluded (B-016)', () => {
  it('a planned future day never enters rolling, ok-rate, streak or the heatmap', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    const year = Number(isoOffset(0).slice(0, 4));
    const past1 = isoOffset(-3);
    const past2 = isoOffset(-2);
    const future = isoOffset(10);

    await seedTarget(userId, `${year}-01-01`, SNAPSHOT.cal_min, SNAPSHOT.cal_max);
    await seedSummaryDay(userId, past1, 1600); // OK (logged, past)
    await seedSummaryDay(userId, past2, 1600); // OK (logged, past)
    await seedSummaryDay(userId, future, 1700); // NOK but in the future → excluded

    // Rolling anchors at the latest logged day ≤ today, never the future day.
    const rolling = await agent.get('/api/v1/stats/rolling');
    expect(rolling.body.as_of).toBe(past2);

    const adh = await agent.get(`/api/v1/stats/adherence?year=${year}`);
    expect(adh.body.key.overall_ok_rate).toBe(1); // future NOK does not dilute the rate
    expect(adh.body.key.current_ok_streak).toBe(2); // future NOK does not break the streak
    const heatmap = adh.body.heatmap as { date: string; status: string }[];
    expect(heatmap.find((c) => c.date === future)!.status).toBe('none'); // grey, not red
  });
});

describe('stats — tenancy & validation', () => {
  it("never reflects another user's days (tenancy isolation)", async () => {
    const alice = await authedAgent(app, 'alice');
    await seedWindow7(alice.userId);

    const bob = await authedAgent(app, 'bob');
    const rolling = await bob.agent.get('/api/v1/stats/rolling');
    expect(rolling.body.as_of).toBeNull();
    const adherence = await bob.agent.get('/api/v1/stats/adherence?year=2026');
    expect(adherence.body.heatmap.every((c: { status: string }) => c.status === 'none')).toBe(true);
    expect(adherence.body.key.overall_ok_rate).toBeNull();
  });

  it('rejects a malformed year with 422', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/stats/adherence?year=not-a-year');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/stats/rolling')).status).toBe(401);
    expect((await request(app).get('/api/v1/stats/adherence?year=2026')).status).toBe(401);
  });
});
