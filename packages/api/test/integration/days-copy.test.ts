import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfPatch,
  csrfPost,
  seedContainer,
  seedFood,
  seedTarget,
  seedWeight,
  type Agent,
} from './helpers.js';

// Integration checks for "Copier hier" (CP-1 / B-082, spec/api/days-meals-leftover.md
// §Day `POST /days/:date/copy-from`): replace the day with a faithful copy of `from`
// (meals + entries + leftovers, or a Partiel total); keep the target's comment + activity;
// reset the verdict to Auto; do NOT re-apply the garde-manger; 409 on an empty source.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function addLine(agent: Agent, csrf: string, mealId: string, foodId: string, grams: number) {
  return csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: grams,
    unit: 'g',
  });
}

const foodIdsOf = (body: { meals: { entries: { food_id: string }[] }[] }): string[] =>
  (body.meals[0]?.entries ?? []).map((e) => e.food_id);

/** Seed yesterday with two lines + a leftover (served total 800, net 100); return its kcal. */
async function seedDetailedYesterday(
  agent: Agent,
  csrf: string,
  rice: string,
  chicken: string,
  containerId: string,
): Promise<number> {
  const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
  const yMeal = yDay.body.meals[0].id as string;
  const yRice = (await addLine(agent, csrf, yMeal, rice, 500)).body.id as string;
  const yChicken = (await addLine(agent, csrf, yMeal, chicken, 300)).body.id as string;
  await csrfPost(agent, csrf, `/api/v1/meals/${yMeal}/leftover`, {
    container_id: containerId,
    gross_grams: 508,
    entry_ids: [yRice, yChicken],
  });
  return (await agent.get(`/api/v1/days/${YESTERDAY}`)).body.totals.kcal as number;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('copy yesterday into the current day (B-082)', () => {
  it('copies meals + entries + leftovers, replaces today, keeps comment/activity, resets verdict', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    const rice = await seedFood(userId, 'Riz');
    const chicken = await seedFood(userId, 'Poulet');
    const water = await seedFood(userId, 'Eau');
    const container = await seedContainer(userId, 'Bowl', 408);

    const yesterdayKcal = await seedDetailedYesterday(
      agent,
      csrf,
      rice.id,
      chicken.id,
      container.id,
    );

    // Today: pre-existing content (must be replaced) + comment/activity/override (kept/reset).
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    await addLine(agent, csrf, tDay.body.meals[0].id as string, water.id, 250);
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      verdict_override: 'OK',
      comment: 'Aujourd',
      activity_level: 'very_active',
    });

    const copied = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, {
      from: YESTERDAY,
    });
    expect(copied.status).toBe(200);

    const meal = copied.body.meals[0];
    const foodIds = foodIdsOf(copied.body);
    expect(foodIds).toContain(rice.id);
    expect(foodIds).toContain(chicken.id);
    expect(foodIds).not.toContain(water.id); // today's prior content was replaced
    expect(meal.leftover_groups).toHaveLength(1);
    expect(meal.leftover_groups[0].container_name).toBe('Bowl');
    expect(meal.leftover_groups[0].gross_grams).toBe(508);
    // Same consumed totals as the source (faithful copy of qty + leftover).
    expect(copied.body.totals.kcal).toBeCloseTo(yesterdayKcal, 5);
    // Target's own comment/activity kept; verdict back to Auto.
    expect(copied.body.comment).toBe('Aujourd');
    expect(copied.body.activity_level).toBe('very_active');
    expect(copied.body.verdict_override).toBeNull();
    expect(copied.body.effective_verdict).toBe(copied.body.verdict_auto);
  });

  it('copies a Partiel source into a Partiel target with the same summary_kcal', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01');
    // Yesterday becomes a summary (Partiel) day via summary_kcal on an empty date.
    await csrfPatch(agent, csrf, `/api/v1/days/${YESTERDAY}`, { summary_kcal: 1500 });

    const copied = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, {
      from: YESTERDAY,
    });
    expect(copied.status).toBe(200);
    expect(copied.body.kind).toBe('summary');
    expect(copied.body.summary_kcal).toBe(1500);
    expect(copied.body.meals).toHaveLength(0);
  });

  it('does not re-apply the garde-manger (a food pinned after the source is not injected)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await seedTarget(userId, '2026-01-01');
    const rice = await seedFood(userId, 'Riz');
    const chicken = await seedFood(userId, 'Poulet');

    // Yesterday has rice only.
    const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    await addLine(agent, csrf, yDay.body.meals[0].id as string, rice.id, 500);

    // Today pins chicken (a global garde-manger food absent from yesterday).
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tMeal = tDay.body.meals[0].id as string;
    const tChicken = (await addLine(agent, csrf, tMeal, chicken.id, 200)).body.id as string;
    await csrfPost(agent, csrf, `/api/v1/meals/${tMeal}/entries/${tChicken}/pin`);

    const copied = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, {
      from: YESTERDAY,
    });
    expect(copied.status).toBe(200);
    const foodIds = foodIdsOf(copied.body);
    expect(foodIds).toContain(rice.id);
    expect(foodIds).not.toContain(chicken.id); // pinned food NOT re-applied
  });
});

describe('copy yesterday — guards (B-082)', () => {
  it('rejects an empty / absent source with 409 copy_source_empty (nothing written)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    await seedTarget(userId, '2026-01-01');
    const water = await seedFood(userId, 'Eau');
    // Today has content that must remain untouched on a failed copy.
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    await addLine(agent, csrf, tDay.body.meals[0].id as string, water.id, 250);

    const res = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, { from: YESTERDAY });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('copy_source_empty');

    const today = await agent.get(`/api/v1/days/${TODAY}`);
    expect(foodIdsOf(today.body)).toContain(water.id); // unchanged
  });

  it('rejects copying a day from itself with 422', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    await seedTarget(userId, '2026-01-01');
    const res = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, { from: TODAY });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });
});
