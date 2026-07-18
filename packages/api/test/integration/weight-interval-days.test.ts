import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost, seedFood, seedTarget, type Agent } from './helpers.js';

// Integration checks for the interval-days recap endpoint (spec/api/weight-targets-stats-
// settings.md §Weight, B-225): every calendar day of [start,end] INCLUSIVE, one element each,
// kcal/macros|null/comment|null mirroring the Journal row, gaps filled as all-null, user-scoped,
// 422 on a bad range. Runs against compose.test.yml.
const app = createApp();

const toUtc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
const snap = () => ({
  cal_min: 1900,
  cal_max: 2100,
  protein_floor_g: null,
  fat_floor_g: null,
  carb_ceiling_g: null,
});

/** Log a detailed day via the real stack: create it, add one referenced 500 g line (→ 1000 kcal /
 *  50 fat / 100 carb / 25 protein with the default seedFood), then set its comment. */
async function logDetailed(
  agent: Agent,
  csrf: string,
  foodId: string,
  date: string,
  comment: string,
): Promise<void> {
  const day = await csrfPost(agent, csrf, `/api/v1/days/${date}`);
  const mealId = day.body.meals[0].id as string;
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: 500,
    unit: 'g',
  });
  await csrfPatch(agent, csrf, `/api/v1/days/${date}`, { comment });
}

/** A summary (Partiel) day carries only a kcal total → macros null on the recap. */
function seedSummaryDay(userId: string, date: string, kcal: number, comment: string) {
  return prisma.dayLog.create({
    data: {
      userId,
      date: toUtc(date),
      kind: 'summary',
      summaryKcal: kcal,
      comment,
      targetSnapshot: snap(),
    },
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /weight/interval-days (B-225)', () => {
  it('returns every calendar day of [start,end] inclusive with kcal/macros/comment, gaps null', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const food = await seedFood(userId, 'Riz');
    await logDetailed(agent, csrf, food.id, '2026-02-01', 'leg day');
    await seedSummaryDay(userId, '2026-02-03', 1800, 'eyeballed');
    // 2026-02-02, -04, -05 are gaps (no day_log row).

    const res = await agent.get('/api/v1/weight/interval-days?start=2026-02-01&end=2026-02-05');
    expect(res.status).toBe(200);
    const days = res.body.data as Array<Record<string, unknown>>;
    expect(days.map((d) => d.date)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
    ]);
    // Detailed day: kcal + macros + comment; 1000 kcal < 1900 min → NOK (B-227 state).
    expect(days[0]).toEqual({
      date: '2026-02-01',
      kcal: 1000,
      macros: { L: 50, G: 100, P: 25 },
      comment: 'leg day',
      state: 'nok',
    });
    // Gap day: all null, not logged.
    expect(days[1]).toEqual({
      date: '2026-02-02',
      kcal: null,
      macros: null,
      comment: null,
      state: 'none',
    });
    // Summary day: kcal + comment, macros null, state 'partiel' (B-227).
    expect(days[2]).toEqual({
      date: '2026-02-03',
      kcal: 1800,
      macros: null,
      comment: 'eyeballed',
      state: 'partiel',
    });
    // Interval summary (B-227): 5 calendar days, 2 logged, avg = (1000+1800)/2 = 1400.
    expect(res.body.summary).toEqual({ day_count: 5, logged_count: 2, avg_kcal: 1400 });
  });

  it('is user-scoped — another tenant sees only empty days over the same range', async () => {
    const alice = await authedAgent(app, 'alice');
    await seedTarget(alice.userId, '2026-01-01');
    const food = await seedFood(alice.userId, 'Riz');
    await logDetailed(alice.agent, alice.csrf, food.id, '2026-02-01', 'private');

    const bob = await authedAgent(app, 'bob');
    const res = await bob.agent.get('/api/v1/weight/interval-days?start=2026-02-01&end=2026-02-02');
    expect(res.status).toBe(200);
    const days = res.body.data as Array<Record<string, unknown>>;
    expect(days).toHaveLength(2);
    expect(days.every((d) => d.kcal === null && d.macros === null && d.comment === null)).toBe(
      true,
    );
  });

  it('422 on an inverted range (start > end)', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/weight/interval-days?start=2026-02-05&end=2026-02-01');
    expect(res.status).toBe(422);
  });

  it('422 on a malformed date', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/weight/interval-days?start=2026-2-1&end=2026-02-05');
    expect(res.status).toBe(422);
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).get(
      '/api/v1/weight/interval-days?start=2026-02-01&end=2026-02-05',
    );
    expect(res.status).toBe(401);
  });
});
