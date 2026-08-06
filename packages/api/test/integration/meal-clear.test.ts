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

// Integration checks for the per-meal clear (MC-1 / B-296, spec/api/days-meals-leftover.md
// §Meals `POST /meals/:mealId/clear`). `delete` applies the day-clear partition scoped to ONE
// meal; `zero` keeps every line at qty 0. Both dissolve the meal's leftover groups, leave the
// other meals alone, and — unlike the day-wide clear — keep a forced verdict.
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

/** A day whose first meal holds a non-pinned line, a pinned line, a custom line and a leftover
 *  group, plus a second meal with one line — the neighbour that must survive untouched. */
async function seedDay(agent: Agent, csrf: string, userId: string) {
  await seedTarget(userId, '2026-01-01');
  await seedWeight(userId, '2026-01-01', 80);
  const rice = await seedFood(userId, 'Riz');
  const chicken = await seedFood(userId, 'Poulet');
  const oats = await seedFood(userId, 'Avoine');
  const container = await seedContainer(userId, 'Bowl', 408);

  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const mealId = day.body.meals[0].id as string;
  const otherMealId = day.body.meals[1].id as string;

  const nonPinned = (await addLine(agent, csrf, mealId, rice.id, 500)).body.id as string;
  const pinned = (await addLine(agent, csrf, mealId, chicken.id, 300)).body.id as string;
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${pinned}/pin`);
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'custom',
    custom_name: 'Café',
    served_quantity: 0,
    snap: { kcal: 5, fat: 0, carb: 1, protein: 0 },
  });
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
    container_id: container.id,
    gross_grams: 508,
    entry_ids: [nonPinned, pinned],
  });
  await addLine(agent, csrf, otherMealId, oats.id, 80);
  await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
    verdict_override: 'OK',
    comment: 'Concert',
    activity_level: 'lightly_active',
  });
  return { mealId, otherMealId, chicken };
}

const clear = (agent: Agent, csrf: string, mealId: string, mode: 'delete' | 'zero') =>
  csrfPost(agent, csrf, `/api/v1/meals/${mealId}/clear`, { mode });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('clear one meal — mode delete (B-296)', () => {
  it('keeps only the garde-manger line at qty 0 and leaves the other meal untouched', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const { mealId, chicken } = await seedDay(agent, csrf, userId);

    const res = await clear(agent, csrf, mealId, 'delete');
    expect(res.status).toBe(200);

    const meal = res.body.meals[0];
    expect(meal.entries).toHaveLength(1);
    expect(meal.entries[0].food_id).toBe(chicken.id);
    expect(meal.entries[0].is_pinned).toBe(true);
    expect(meal.entries[0].served_quantity).toBe(0);
    // D4: the deduction has nothing left to prorate.
    expect(meal.leftover_groups).toHaveLength(0);
    // The neighbouring meal is none of this action's business.
    expect(res.body.meals[1].entries).toHaveLength(1);
    expect(res.body.meals[1].entries[0].served_quantity).toBe(80);
  });

  it('keeps a forced verdict, the comment and the activity level', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    const { mealId } = await seedDay(agent, csrf, userId);

    const res = await clear(agent, csrf, mealId, 'delete');
    // Unlike the day-wide clear: emptying one meal is a line edit, and a line edit has never
    // cleared a forced verdict (the rule the per-meal copy already follows).
    expect(res.body.verdict_override).toBe('OK');
    expect(res.body.effective_verdict).toBe('OK');
    expect(res.body.comment).toBe('Concert');
    expect(res.body.activity_level).toBe('lightly_active');
  });
});

describe('clear one meal — mode zero (B-296)', () => {
  it('keeps every line at quantity 0, preserving food, unit and pin', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    const { mealId } = await seedDay(agent, csrf, userId);

    const res = await clear(agent, csrf, mealId, 'zero');
    expect(res.status).toBe(200);

    const meal = res.body.meals[0];
    expect(meal.entries).toHaveLength(3); // nothing deleted
    for (const e of meal.entries) {
      expect(e.served_quantity).toBe(0);
      expect(e.consumed.grams).toBe(0);
    }
    // The pin survives the reset, and so does the line's own unit.
    const pinnedLine = meal.entries.find((e: { is_pinned: boolean }) => e.is_pinned);
    expect(pinnedLine.unit).toBe('g');
    expect(meal.leftover_groups).toHaveLength(0);
  });
});

describe('clear one meal — undo and guards (B-296)', () => {
  it('captures a restore point, so Annuler brings the meal back', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    const { mealId } = await seedDay(agent, csrf, userId);

    await clear(agent, csrf, mealId, 'delete');
    const undone = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(undone.status).toBe(200);
    expect(undone.body.meals[0].entries).toHaveLength(3);
    expect(undone.body.meals[0].leftover_groups).toHaveLength(1);
  });

  it('does not burn the restore point when there is nothing to clear', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    const { mealId, otherMealId } = await seedDay(agent, csrf, userId);

    // A day-level clear leaves its own point; clearing the (now empty) second meal must not
    // overwrite it with a no-op snapshot, or Annuler would restore nothing.
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    const empty = await clear(agent, csrf, otherMealId, 'delete');
    expect(empty.status).toBe(200);

    const undone = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(undone.body.meals[0].entries).toHaveLength(3);
    expect(undone.body.meals[0].entries.map((e: { id: string }) => e.id)).not.toContain(mealId);
  });

  it('rejects an unknown meal with 404', async () => {
    const { agent, csrf } = await authedAgent(app, 'frank');
    const res = await clear(agent, csrf, '00000000-0000-0000-0000-000000000000', 'delete');
    expect(res.status).toBe(404);
  });

  it('never reaches another user’s meal (404, not 403)', async () => {
    const owner = await authedAgent(app, 'grace');
    const { mealId } = await seedDay(owner.agent, owner.csrf, owner.userId);
    const other = await authedAgent(app, 'heidi');

    const res = await clear(other.agent, other.csrf, mealId, 'delete');
    expect(res.status).toBe(404);
    // And the owner's meal is intact.
    const day = await owner.agent.get(`/api/v1/days/${TODAY}`);
    expect(day.body.meals[0].entries).toHaveLength(3);
  });

  it('refuses a malformed mode with 422', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'ivan');
    const { mealId } = await seedDay(agent, csrf, userId);
    const res = await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/clear`, { mode: 'wipe' });
    expect(res.status).toBe(422);
  });
});
