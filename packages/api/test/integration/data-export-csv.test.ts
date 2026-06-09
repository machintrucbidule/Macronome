import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfPatch,
  csrfPost,
  seedFood,
  seedTarget,
  seedWeight,
  type Agent,
} from './helpers.js';

// Integration checks for the per-page CSV exports (EX-1 / B-132, spec/api/data-export-import.md):
// the Journal recap spans ALL years (one row per logged day) and the weigh-in export is the FULL
// history. Standard CSV, English headers, canonical values; cross-tenant isolation holds.
const app = createApp();

const JOURNAL_HEADER = 'date,calories_kcal,fat_g,carb_g,protein_g,verdict,activity,comment';
const WEIGHT_HEADER = 'date,weight_kg,waist_cm,diet_flag,note';

/** Log a detailed day: create it, add one referenced 500 g line (→ 1000 kcal), set activity+comment. */
async function logDay(
  agent: Agent,
  csrf: string,
  foodId: string,
  date: string,
  activity: string,
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
  await csrfPatch(agent, csrf, `/api/v1/days/${date}`, { activity_level: activity, comment });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CSV export (EX-1 / B-132)', () => {
  it('journal.csv returns one recap row per logged day across ALL years', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01'); // retroactive earliest-target covers the 2025 day (B-090)
    const food = await seedFood(userId, 'Riz'); // 200 kcal / 10 fat / 20 carb / 5 protein per 100 g
    await logDay(agent, csrf, food.id, '2025-06-15', 'moderately_active', 'training');
    await logDay(agent, csrf, food.id, '2026-03-01', 'lightly_active', 'tired, sore');

    const res = await agent.get('/api/v1/data/export/journal.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.csv');

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe(JOURNAL_HEADER);
    expect(lines).toHaveLength(3); // header + the two logged days, oldest first
    expect(lines[1]).toBe('2025-06-15,1000,50,100,25,NOK,moderately_active,training');
    // A comma in the comment forces the cell to be quoted (RFC 4180).
    expect(lines[2]).toBe('2026-03-01,1000,50,100,25,NOK,lightly_active,"tired, sore"');
  });

  it('weight.csv returns the full weigh-in history, oldest first, with escaping', async () => {
    const { agent, userId } = await authedAgent(app, 'wendy');
    await seedWeight(userId, '2025-12-01', 81);
    await prisma.weightEntry.create({
      data: {
        userId,
        date: new Date('2026-01-15T00:00:00.000Z'),
        weightKg: 80,
        waistCm: 90,
        dietFlag: 'not_in_diet',
        note: 'after holidays, big',
      },
    });
    await seedWeight(userId, '2026-02-01', 79);

    const res = await agent.get('/api/v1/data/export/weight.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe(WEIGHT_HEADER);
    expect(lines).toHaveLength(4); // header + three weigh-ins
    expect(lines[1]).toBe('2025-12-01,81,,in_diet,');
    expect(lines[2]).toBe('2026-01-15,80,90,not_in_diet,"after holidays, big"');
    expect(lines[3]).toBe('2026-02-01,79,,in_diet,');
  });

  it('is user-scoped: a fresh account exports only its header (no other tenant rows)', async () => {
    const { agent } = await authedAgent(app, 'bob');
    const journal = await agent.get('/api/v1/data/export/journal.csv');
    expect(journal.text).toBe(JOURNAL_HEADER);
    const weight = await agent.get('/api/v1/data/export/weight.csv');
    expect(weight.text).toBe(WEIGHT_HEADER);
  });
});
