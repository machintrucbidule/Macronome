import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent } from './helpers.js';

// Integration checks for GET /journal (spec/api/days-meals-leftover.md §Journal). The
// response carries the global min/max logged-day year that bounds the year selector
// (B-067), independent of the requested year.
const app = createApp();

const SNAPSHOT = {
  cal_min: 1900,
  cal_max: 2100,
  protein_floor_g: null,
  fat_floor_g: null,
  carb_ceiling_g: null,
};

function seedDay(userId: string, date: string, summaryKcal: number): Promise<unknown> {
  return prisma.dayLog.create({
    data: {
      userId,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: 'summary',
      summaryKcal,
      targetSnapshot: SNAPSHOT,
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

interface Row {
  date: string;
  state: string;
  kind: string | null;
  kcal: number;
  kcal_gap: number | null;
  editable_kcal: boolean;
}
const rowMap = (data: Row[]): Map<string, Row> => new Map(data.map((r) => [r.date, r]));

describe('GET /journal — full calendar trame (day-model)', () => {
  it('fills every calendar day of a past year: empty days are red, logged days carry state', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedDay(userId, '2024-06-01', 2000); // first record (yellow summary)
    await seedDay(userId, '2024-06-03', 1950); // yellow summary

    const res = await agent.get('/api/v1/journal?year=2024');
    expect(res.status).toBe(200);
    // day_count is the LOGGED-day count, distinct from the rendered trame length.
    expect(res.body.day_count).toBe(2);
    expect(res.body.data.length).toBeGreaterThan(2);
    // newest-first; trame anchored at the first record (no red rows before it) → Dec 31.
    expect(res.body.data[0].date).toBe('2024-12-31');
    expect(res.body.data[res.body.data.length - 1].date).toBe('2024-06-01');

    const byDate = rowMap(res.body.data);
    expect(byDate.get('2024-06-01')!.state).toBe('yellow');
    expect(byDate.get('2024-06-03')!.state).toBe('yellow');
    // an untouched day inside the span is a red, empty, editable row.
    const gap = byDate.get('2024-06-02')!;
    expect(gap.state).toBe('red');
    expect(gap.kind).toBeNull();
    expect(gap.kcal).toBe(0);
    expect(gap.editable_kcal).toBe(true);
  });

  it('lists a future day inline but excludes it from the logged-day count', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    const futureYear = new Date().getUTCFullYear() + 1;
    const future = `${futureYear}-06-15`;
    await seedDay(userId, future, 1800);

    const res = await agent.get(`/api/v1/journal?year=${futureYear}`);
    expect(res.status).toBe(200);
    // no red empties for a future-only year; just the planned row, listed inline.
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe(future);
    expect(res.body.data[0].state).toBe('yellow');
    expect(res.body.day_count).toBe(0); // future days never count until their date arrives
  });
});

describe('GET /journal — kcal écart vs the upper target (B-138)', () => {
  it('exposes the signed kcal_gap (vs cal_max) on every logged day, null on red days', async () => {
    const { agent, userId } = await authedAgent(app, 'dave');
    await seedDay(userId, '2024-06-01', 1500); // under the band → 1500 − 2100 = -600
    await seedDay(userId, '2024-06-02', 2000); // in-band OK day → 2000 − 2100 = -100 (still shown)
    await seedDay(userId, '2024-06-04', 2400); // over cal_max → 2400 − 2100 = +300

    const res = await agent.get('/api/v1/journal?year=2024');
    expect(res.status).toBe(200);
    const byDate = rowMap(res.body.data as Row[]);
    expect(byDate.get('2024-06-01')!.kcal_gap).toBe(-600);
    expect(byDate.get('2024-06-02')!.kcal_gap).toBe(-100);
    expect(byDate.get('2024-06-04')!.kcal_gap).toBe(300);
    // a red, empty trame day carries no écart (no real total).
    expect(byDate.get('2024-06-03')!.kcal_gap).toBeNull();
  });
});

describe('GET /journal (B-067 year bounds)', () => {
  it('reports the global range even when the requested year is empty', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    await seedDay(userId, '2025-09-09', 2000);

    const res = await agent.get('/api/v1/journal?year=2030');
    expect(res.status).toBe(200);
    expect(res.body.day_count).toBe(0);
    expect(res.body.min_year).toBe(2025);
    expect(res.body.max_year).toBe(2025);
  });

  it('returns null bounds and NO trame rows when the user has no day at all', async () => {
    const { agent } = await authedAgent(app, 'carol');

    const res = await agent.get('/api/v1/journal?year=2026');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0); // no first record → no red trame for a new account
    expect(res.body.day_count).toBe(0);
    expect(res.body.min_year).toBeNull();
    expect(res.body.max_year).toBeNull();
  });
});
