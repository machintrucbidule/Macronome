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

// GET /days/:date/tone (B-262, spec/logic/day-snapshot-verdict.md §8b). Two things matter here:
// the tone matches the domain oracles, and the route WRITES NOTHING. The second is its whole
// reason to exist — `GET /days/:date` re-persists the live snapshot and verdict_auto on a
// non-past date, so polling that from the app frame would write on every window focus.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

function addLine(agent: Agent, csrf: string, mealId: string, foodId: string, grams: number) {
  return csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: grams,
    unit: 'g',
  });
}

/** Seed a day whose Σ kcal lands where the caller wants, via a 1 kcal/g food. */
async function dayWithKcal(agent: Agent, csrf: string, userId: string, kcal: number) {
  const food = await seedFood(userId, 'Étalon', { kcal: 100, fat: 0, carb: 25, protein: 0 });
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const mealId = day.body.meals[0].id as string;
  await addLine(agent, csrf, mealId, food.id, kcal);
  return mealId;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /days/:date/tone (B-262)', () => {
  it('is `none` on a never-touched date, and creates no day_log', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');

    const res = await agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date: TODAY, tone: 'none' });
    expect(await prisma.dayLog.count({ where: { userId } })).toBe(0);
  });

  it('is `ok` inside the calorie band', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01'); // neutral band 1900–2100
    await seedWeight(userId, '2026-01-01', 80);
    await dayWithKcal(agent, csrf, userId, 2000);

    const res = await agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.body.tone).toBe('ok');
  });

  it('is `warn` when NOK but still under the estimated burn', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80); // burn well above 1200 kcal
    await dayWithKcal(agent, csrf, userId, 1200); // under cal_min → NOK, deep deficit

    const res = await agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.body.tone).toBe('warn');
  });

  it('is `nok` when NOK and over the burn', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await dayWithKcal(agent, csrf, userId, 6000); // over cal_max and far over any burn

    const res = await agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.body.tone).toBe('nok');
  });

  it('follows the manual override — forcing OK turns the tone ok', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await dayWithKcal(agent, csrf, userId, 6000);
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, { verdict_override: 'OK' });

    const res = await agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.body.tone).toBe('ok');
  });

  it('WRITES NOTHING — unlike GET /days/:date, which re-persists the snapshot', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'frank');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await dayWithKcal(agent, csrf, userId, 2000);

    const before = await prisma.dayLog.findFirstOrThrow({ where: { userId } });
    // A pause so a write would produce a different updatedAt, not an identical timestamp.
    await new Promise((resolve) => setTimeout(resolve, 25));

    await agent.get(`/api/v1/days/${TODAY}/tone`);
    const afterTone = await prisma.dayLog.findFirstOrThrow({ where: { userId } });
    expect(afterTone.updatedAt.getTime()).toBe(before.updatedAt.getTime());

    // Control: the day sheet DOES touch the row, which is exactly why the tone route exists.
    await agent.get(`/api/v1/days/${TODAY}`);
    const afterSheet = await prisma.dayLog.findFirstOrThrow({ where: { userId } });
    expect(afterSheet.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('never crosses tenants: another user’s day reads as `none`', async () => {
    const owner = await authedAgent(app, 'grace');
    await seedTarget(owner.userId, '2026-01-01');
    await seedWeight(owner.userId, '2026-01-01', 80);
    await dayWithKcal(owner.agent, owner.csrf, owner.userId, 2000);

    const stranger = await authedAgent(app, 'heidi');
    await seedTarget(stranger.userId, '2026-01-01');
    const res = await stranger.agent.get(`/api/v1/days/${TODAY}/tone`);
    expect(res.body.tone).toBe('none');
  });
});
