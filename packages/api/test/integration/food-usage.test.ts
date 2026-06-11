import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, seedFood } from './helpers.js';

// Usage-based search-picker ordering (FU-1/B-151). Seeds meal_entry logs over dated days and
// checks that the pickers list most-used-first over the 90-day window (a >90-day-old log does
// not count), while the Aliments default list stays A→Z. Runs against compose.test.yml Postgres.
const app = createApp();

/** A YYYY-MM-DD date `daysAgo` before today (UTC). */
function iso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Log one referenced entry for `foodId` on `dateIso` (own day_log + meal). `qty` defaults to a
 *  consumed 100 g; pass 0 to log an unfilled pinned placeholder line (B-045) that must NOT count
 *  as usage (B-157). */
async function logOn(userId: string, foodId: string, dateIso: string, qty = 100): Promise<void> {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = await prisma.dayLog.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date, kind: 'detailed', targetSnapshot: {} },
  });
  const meal = await prisma.meal.create({
    data: { dayLogId: day.id, slotName: 'Repas', orderIndex: 0 },
  });
  await prisma.mealEntry.create({
    data: {
      mealId: meal.id,
      kind: 'referenced',
      foodId,
      servedQuantity: qty,
      unit: 'g',
      servedGrams: qty,
      snapKcal: 0,
      snapFat: 0,
      snapCarb: 0,
      snapProtein: 0,
      orderIndex: 0,
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

describe('food/recipe search ordering by usage (FU-1)', () => {
  it('pickers rank most-used-first (90-day window, recency tiebreak); Aliments default stays A→Z', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    // A→Z by name: Avocat, Banane, Carotte, Dattes, Epinards.
    const avocat = await seedFood(userId, 'Avocat');
    const banane = await seedFood(userId, 'Banane');
    const carotte = await seedFood(userId, 'Carotte');
    const dattes = await seedFood(userId, 'Dattes');
    const epinards = await seedFood(userId, 'Epinards');

    // Banane: 3 logs (most used, most recent). Carotte: 1 recent. Avocat: 1 older (same count as
    // Carotte → loses the recency tiebreak). Dattes: 1 log but >90 days ago → does NOT count.
    // Epinards: 5 recent logs but all quantity-0 placeholder lines → must NOT count (B-157), so it
    // scores 0 despite outnumbering everyone, and never outranks a genuinely-consumed food.
    await logOn(userId, banane.id, iso(1));
    await logOn(userId, banane.id, iso(4));
    await logOn(userId, banane.id, iso(5));
    await logOn(userId, carotte.id, iso(2));
    await logOn(userId, avocat.id, iso(30));
    await logOn(userId, dattes.id, iso(100));
    await logOn(userId, epinards.id, iso(1), 0);
    await logOn(userId, epinards.id, iso(2), 0);
    await logOn(userId, epinards.id, iso(3), 0);
    await logOn(userId, epinards.id, iso(4), 0);
    await logOn(userId, epinards.id, iso(5), 0);

    // /search/loggable — used by the Repas + recipe-ingredient pickers. Epinards (qty-0 only)
    // sinks to the count-0 alphabetical tail, behind Dattes — it does not outrank consumed foods.
    const loggable = await agent.get('/api/v1/search/loggable');
    expect(loggable.status).toBe(200);
    expect(loggable.body.data.map((f: { name: string }) => f.name)).toEqual([
      'Banane',
      'Carotte',
      'Avocat',
      'Dattes',
      'Epinards',
    ]);

    // /foods?sort=usage — pantry picker + Aliments "Utilisation" column; carries the 90-day count.
    const byUsage = await agent.get('/api/v1/foods').query({ sort: 'usage', dir: 'desc' });
    expect(byUsage.status).toBe(200);
    expect(
      byUsage.body.data.map((f: { name: string; usage: number }) => [f.name, f.usage]),
    ).toEqual([
      ['Banane', 3],
      ['Carotte', 1],
      ['Avocat', 1],
      ['Dattes', 0], // the >90-day-old log is excluded
      ['Epinards', 0], // 5 logs but all quantity-0 → not consumed, count 0 (B-157)
    ]);

    // /foods default — Aliments management page keeps A→Z and now carries the 90-day consumed
    // count on every row, without sorting by usage (B-156).
    const byName = await agent.get('/api/v1/foods');
    expect(byName.status).toBe(200);
    expect(byName.body.data.map((f: { name: string; usage: number }) => [f.name, f.usage])).toEqual(
      [
        ['Avocat', 1],
        ['Banane', 3],
        ['Carotte', 1],
        ['Dattes', 0],
        ['Epinards', 0],
      ],
    );
  });
});
