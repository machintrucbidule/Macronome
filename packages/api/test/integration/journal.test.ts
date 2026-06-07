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

describe('GET /journal (B-067 year bounds)', () => {
  it('returns the requested year and the global min/max data year', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedDay(userId, '2024-06-01', 2000);
    await seedDay(userId, '2026-02-10', 1950);
    await seedDay(userId, '2026-03-01', 2050);

    const res = await agent.get('/api/v1/journal?year=2026');
    expect(res.status).toBe(200);
    expect(res.body.day_count).toBe(2);
    expect(res.body.data.map((r: { date: string }) => r.date)).toEqual([
      '2026-03-01',
      '2026-02-10',
    ]);
    expect(res.body.min_year).toBe(2024);
    expect(res.body.max_year).toBe(2026);
  });

  it('reports the global range even when the requested year is empty', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    await seedDay(userId, '2025-09-09', 2000);

    const res = await agent.get('/api/v1/journal?year=2030');
    expect(res.status).toBe(200);
    expect(res.body.day_count).toBe(0);
    expect(res.body.min_year).toBe(2025);
    expect(res.body.max_year).toBe(2025);
  });

  it('returns null bounds when the user has no logged day', async () => {
    const { agent } = await authedAgent(app, 'carol');

    const res = await agent.get('/api/v1/journal?year=2026');
    expect(res.status).toBe(200);
    expect(res.body.day_count).toBe(0);
    expect(res.body.min_year).toBeNull();
    expect(res.body.max_year).toBeNull();
  });
});
