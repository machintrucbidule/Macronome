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
  type Agent,
} from './helpers.js';

// Integration checks for the per-meal copy (CP-2 / B-248, spec/api/days-meals-leftover.md
// §Meals `POST /meals/:mealId/copy-from`): replace ONE meal with the matching meal of `from`
// (by name, else by position), inheriting the day-level copy's faithful semantics, and refuse
// — writing nothing — when there is no match or nothing to copy.
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

interface DayBody {
  meals: { id: string; slot_name: string; entries: { food_id: string }[] }[];
}
const mealNamed = (body: DayBody, name: string) => body.meals.find((m) => m.slot_name === name)!;
const foodIdsOf = (meal: { entries: { food_id: string }[] }): string[] =>
  meal.entries.map((e) => e.food_id);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('copy one meal from yesterday (B-248)', () => {
  it('copies the same-named meal with its snapshots and leftover group, leaving other meals alone', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    const rice = await seedFood(userId, 'Riz');
    const chicken = await seedFood(userId, 'Poulet');
    const water = await seedFood(userId, 'Eau');
    const container = await seedContainer(userId, 'Bowl', 408);

    // Yesterday: lunch has two lines + a leftover; dinner has water.
    const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    const yLunch = mealNamed(yDay.body as DayBody, 'Déjeuner');
    const yRice = (await addLine(agent, csrf, yLunch.id, rice.id, 500)).body.id as string;
    const yChicken = (await addLine(agent, csrf, yLunch.id, chicken.id, 300)).body.id as string;
    await csrfPost(agent, csrf, `/api/v1/meals/${yLunch.id}/leftover`, {
      container_id: container.id,
      gross_grams: 508,
      entry_ids: [yRice, yChicken],
    });
    const yDinner = mealNamed(yDay.body as DayBody, 'Dîner');
    await addLine(agent, csrf, yDinner.id, water.id, 250);

    // Today: an empty lunch and a dinner with its own line, which must survive untouched.
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tLunch = mealNamed(tDay.body as DayBody, 'Déjeuner');
    const tDinner = mealNamed(tDay.body as DayBody, 'Dîner');
    await addLine(agent, csrf, tDinner.id, water.id, 100);

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${tLunch.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(res.status).toBe(200);

    const lunch = mealNamed(res.body as DayBody, 'Déjeuner');
    expect(foodIdsOf(lunch)).toEqual([rice.id, chicken.id]);
    expect(lunch.entries[0]).toMatchObject({ served_quantity: 500, unit: 'g' });
    // The leftover group came over verbatim, frozen container value included.
    const groups = (lunch as unknown as { leftover_groups: { container_name: string }[] })
      .leftover_groups;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ container_name: 'Bowl', gross_grams: 508 });
    // The other meal is untouched — this is a per-meal copy, not a day copy.
    expect(foodIdsOf(mealNamed(res.body as DayBody, 'Dîner'))).toEqual([water.id]);
  });

  it('replaces the target meal content and keeps a forced verdict (a line edit, not a day copy)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedTarget(userId, '2026-01-01');
    const rice = await seedFood(userId, 'Riz');
    const water = await seedFood(userId, 'Eau');

    const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    await addLine(agent, csrf, mealNamed(yDay.body as DayBody, 'Déjeuner').id, rice.id, 500);

    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tLunch = mealNamed(tDay.body as DayBody, 'Déjeuner');
    await addLine(agent, csrf, tLunch.id, water.id, 250);
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      verdict_override: 'OK',
      comment: 'Aujourd',
    });

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${tLunch.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(res.status).toBe(200);
    expect(foodIdsOf(mealNamed(res.body as DayBody, 'Déjeuner'))).toEqual([rice.id]);
    expect(res.body.comment).toBe('Aujourd');
    expect(res.body.verdict_override).toBe('OK');
  });
});

// Source matching: the same name first, the same rank as the fallback.
describe('copy one meal from yesterday — source matching (B-248)', () => {
  it('matches by name before position, and falls back to position when no name matches', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await seedTarget(userId, '2026-01-01');
    const rice = await seedFood(userId, 'Riz');
    const water = await seedFood(userId, 'Eau');

    // Yesterday: the FIRST meal holds water, the third (Dîner) holds rice.
    const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    await addLine(agent, csrf, mealNamed(yDay.body as DayBody, 'Petit déjeuner').id, water.id, 250);
    await addLine(agent, csrf, mealNamed(yDay.body as DayBody, 'Dîner').id, rice.id, 500);

    // Name wins: today's Dîner (position 2) takes yesterday's Dîner, not its positional twin.
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tDinner = mealNamed(tDay.body as DayBody, 'Dîner');
    const byName = await csrfPost(agent, csrf, `/api/v1/meals/${tDinner.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(foodIdsOf(mealNamed(byName.body as DayBody, 'Dîner'))).toEqual([rice.id]);

    // Rename today's first meal: no name match left, so it falls back to yesterday's position 0.
    const tFirst = mealNamed(tDay.body as DayBody, 'Petit déjeuner');
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}/meals/${tFirst.id}`, {
      slot_name: 'Brunch',
    });
    const byPosition = await csrfPost(agent, csrf, `/api/v1/meals/${tFirst.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(byPosition.status).toBe(200);
    expect(foodIdsOf(mealNamed(byPosition.body as DayBody, 'Brunch'))).toEqual([water.id]);
  });
});

// The refusals: every one of them must leave the day exactly as it was.
describe('copy one meal from yesterday — refusals (B-248)', () => {
  it('refuses with copy_meal_not_found when neither the name nor the position resolves', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    await seedTarget(userId, '2026-01-01');
    const rice = await seedFood(userId, 'Riz');
    const water = await seedFood(userId, 'Eau');

    // Yesterday: a single meal (position 0) named Déjeuner, with content.
    const yDay = await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    const yBody = yDay.body as DayBody;
    await addLine(agent, csrf, mealNamed(yBody, 'Déjeuner').id, rice.id, 500);
    for (const name of ['Petit déjeuner', 'Dîner', 'Collation']) {
      await agent
        .delete(`/api/v1/days/${YESTERDAY}/meals/${mealNamed(yBody, name).id}`)
        .set('x-csrf-token', csrf);
    }

    // Today's Collation (position 3) has no name twin and no meal at that rank yesterday.
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tSnack = mealNamed(tDay.body as DayBody, 'Collation');
    await addLine(agent, csrf, tSnack.id, water.id, 100);

    const res = await csrfPost(agent, csrf, `/api/v1/meals/${tSnack.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('copy_meal_not_found');
    // Nothing written: the meal still holds its own line.
    const after = await agent.get(`/api/v1/days/${TODAY}`);
    expect(foodIdsOf(mealNamed(after.body as DayBody, 'Collation'))).toEqual([water.id]);
  });

  it('refuses an empty source (empty day, empty matched meal, or a Partiel source)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    await seedTarget(userId, '2026-01-01');
    const water = await seedFood(userId, 'Eau');
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tLunch = mealNamed(tDay.body as DayBody, 'Déjeuner');
    await addLine(agent, csrf, tLunch.id, water.id, 100);
    const copy = () =>
      csrfPost(agent, csrf, `/api/v1/meals/${tLunch.id}/copy-from`, { from: YESTERDAY });

    // (a) yesterday does not exist at all.
    expect((await copy()).body.error.code).toBe('copy_source_empty');

    // (b) yesterday exists but every meal is empty.
    await csrfPost(agent, csrf, `/api/v1/days/${YESTERDAY}`);
    expect((await copy()).body.error.code).toBe('copy_source_empty');

    // (c) yesterday has content elsewhere, but the matched meal (Déjeuner) is empty.
    const yDay = await agent.get(`/api/v1/days/${YESTERDAY}`);
    await addLine(agent, csrf, mealNamed(yDay.body as DayBody, 'Dîner').id, water.id, 250);
    const emptyMatch = await copy();
    expect(emptyMatch.status).toBe(409);
    expect(emptyMatch.body.error.code).toBe('copy_source_empty');

    // The target kept its own line throughout.
    const after = await agent.get(`/api/v1/days/${TODAY}`);
    expect(foodIdsOf(mealNamed(after.body as DayBody, 'Déjeuner'))).toEqual([water.id]);
  });

  it('refuses the meal’s own day as source, another user’s meal, and a converted Partiel day', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'frank');
    await seedTarget(userId, '2026-01-01');
    const water = await seedFood(userId, 'Eau');
    const tDay = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
    const tLunch = mealNamed(tDay.body as DayBody, 'Déjeuner');

    // from == the meal's own day → 422.
    const same = await csrfPost(agent, csrf, `/api/v1/meals/${tLunch.id}/copy-from`, {
      from: TODAY,
    });
    expect(same.status).toBe(422);

    // Another user's meal → 404 (never 403: no existence leak).
    const other = await authedAgent(app, 'grace');
    const foreign = await csrfPost(
      other.agent,
      other.csrf,
      `/api/v1/meals/${tLunch.id}/copy-from`,
      {
        from: YESTERDAY,
      },
    );
    expect(foreign.status).toBe(404);

    // Converting the day to Partiel discards its meals, so the id is gone → 404 (the service's
    // summary_day_readonly guard is an unreachable safety net; spec/api §Meals copy-from).
    await addLine(agent, csrf, tLunch.id, water.id, 100);
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/summary`);
    const summary = await csrfPost(agent, csrf, `/api/v1/meals/${tLunch.id}/copy-from`, {
      from: YESTERDAY,
    });
    expect(summary.status).toBe(404);
  });
});
