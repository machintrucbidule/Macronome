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

// Integration checks for "Tout effacer" (B-046, spec/api/days-meals-leftover.md
// §Day `POST /days/:date/clear`): the clear removes logged foods + leftovers, keeps the
// garde-manger lines at qty 0, keeps comment + activity, and resets the verdict to Auto.
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

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('clear the day (B-046)', () => {
  it('drops foods + leftovers, keeps pins@0 + comment + activity, resets verdict to Auto', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    const rice = await seedFood(userId, 'Riz'); // not pinned
    const chicken = await seedFood(userId, 'Poulet'); // pinned
    const container = await seedContainer(userId, 'Bowl', 408);

    const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const mealId = day.body.meals[0].id as string;

    const nonPinned = (await addLine(agent, csrf, mealId, rice.id, 500)).body.id as string;
    const pinned = (await addLine(agent, csrf, mealId, chicken.id, 300)).body.id as string;
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${pinned}/pin`);
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
      kind: 'custom',
      custom_name: 'Café',
      served_quantity: 0,
      snap: { kcal: 5, fat: 0, carb: 1, protein: 0 },
    });
    // A leftover over the two referenced lines (served total 800, net 100).
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
      container_id: container.id,
      gross_grams: 508,
      entry_ids: [nonPinned, pinned],
    });
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      verdict_override: 'OK',
      comment: 'Concert',
      activity_level: 'lightly_active',
    });

    const cleared = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect(cleared.status).toBe(200);

    const meal = cleared.body.meals[0];
    // Only the pinned (garde-manger) line survives, at qty 0; non-pinned + custom are gone.
    expect(meal.entries).toHaveLength(1);
    const kept = meal.entries[0];
    expect(kept.food_id).toBe(chicken.id);
    expect(kept.is_pinned).toBe(true);
    expect(kept.served_quantity).toBe(0);
    expect(kept.consumed.grams).toBe(0);
    // Leftovers removed.
    expect(meal.leftover_groups).toHaveLength(0);
    // Verdict back to Auto; comment + activity preserved.
    expect(cleared.body.verdict_override).toBeNull();
    expect(cleared.body.effective_verdict).toBe(cleared.body.verdict_auto);
    expect(cleared.body.comment).toBe('Concert');
    expect(cleared.body.activity_level).toBe('lightly_active');
  });

  it('is a no-op on a never-materialized scaffold day (200)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01');
    const res = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('detailed');
  });

  it('rejects a summary (imported) day with 409 summary_day_readonly', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await prisma.dayLog.create({
      data: {
        userId,
        date: new Date(`${TODAY}T00:00:00.000Z`),
        kind: 'summary',
        summaryKcal: 1800,
        targetSnapshot: {
          cal_min: 1900,
          cal_max: 2100,
          protein_floor_g: null,
          fat_floor_g: null,
          carb_ceiling_g: null,
        },
      },
    });
    const res = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('summary_day_readonly');
  });
});
