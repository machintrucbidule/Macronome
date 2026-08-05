import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  authedAgent,
  csrfDelete,
  csrfPatch,
  csrfPost,
  seedContainer,
  seedFood,
  seedTarget,
  seedWeight,
  type Agent,
} from './helpers.js';

// Undo of a destructive day action (B-261, spec/api/days-meals-leftover.md §Day
// `POST /days/:date/undo`). The point of the server-side restore point is FIDELITY: a
// browser-side replay could not bring leftover groups back, because the stored group carries the
// container's frozen name + tare but never its id. So the leftover assertions below are the
// heart of this file, not a detail.
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

/** A day with two lines, a leftover group over both, a comment, an activity and an override. */
async function seedRichDay(agent: Agent, csrf: string, userId: string) {
  await seedTarget(userId, '2026-01-01');
  await seedWeight(userId, '2026-01-01', 80);
  const rice = await seedFood(userId, 'Riz');
  const chicken = await seedFood(userId, 'Poulet');
  const container = await seedContainer(userId, 'Bowl', 408);

  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const mealId = day.body.meals[0].id as string;
  const a = (await addLine(agent, csrf, mealId, rice.id, 500)).body.id as string;
  const b = (await addLine(agent, csrf, mealId, chicken.id, 300)).body.id as string;
  await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/leftover`, {
    container_id: container.id,
    gross_grams: 508,
    entry_ids: [a, b],
  });
  await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
    verdict_override: 'OK',
    comment: 'Concert',
    activity_level: 'lightly_active',
  });
  const before = await agent.get(`/api/v1/days/${TODAY}`);
  return { mealId, before: before.body };
}

/** The parts of a day an undo must reproduce exactly. */
function shape(day: Record<string, unknown>) {
  const meals = day.meals as {
    slot_name: string;
    entries: { custom_name: string | null; served_quantity: number; consumed: { grams: number } }[];
    leftover_groups: { container_name: string; tare_g: number; gross_grams: number }[];
  }[];
  return {
    comment: day.comment,
    activity_level: day.activity_level,
    verdict_override: day.verdict_override,
    totals: day.totals,
    meals: meals.map((m) => ({
      slot_name: m.slot_name,
      entries: m.entries.map((e) => ({
        served_quantity: e.served_quantity,
        consumed_grams: e.consumed.grams,
      })),
      leftover_groups: m.leftover_groups.map((g) => ({
        container_name: g.container_name,
        tare_g: g.tare_g,
        gross_grams: g.gross_grams,
      })),
    })),
  };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('undo a destructive day action (B-261)', () => {
  it('restores a cleared day verbatim — lines, leftover group and frozen container included', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const { before } = await seedRichDay(agent, csrf, userId);

    const cleared = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.meals[0].leftover_groups).toHaveLength(0);

    const undone = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(undone.status).toBe(200);
    expect(shape(undone.body)).toEqual(shape(before));
    // The leftover deduction is back, with the container value frozen at apply time.
    expect(undone.body.meals[0].leftover_groups[0].container_name).toBe('Bowl');
    expect(undone.body.meals[0].leftover_groups[0].tare_g).toBe(408);
  });

  it('restores a day overwritten by copy-from', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    const { before } = await seedRichDay(agent, csrf, userId);
    // A source day with its own content, so the copy is accepted.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const other = await seedFood(userId, 'Pâtes');
    const src = await csrfPost(agent, csrf, `/api/v1/days/${yesterday}`);
    await addLine(agent, csrf, src.body.meals[0].id as string, other.id, 200);

    const copied = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/copy-from`, {
      from: yesterday,
    });
    expect(copied.status).toBe(200);

    const undone = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(undone.status).toBe(200);
    expect(shape(undone.body)).toEqual(shape(before));
  });

  it('restores a deleted meal with its entries and leftovers', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    const { mealId, before } = await seedRichDay(agent, csrf, userId);

    const removed = await csrfDelete(agent, csrf, `/api/v1/days/${TODAY}/meals/${mealId}`);
    expect(removed.status).toBe(204);

    const undone = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(undone.status).toBe(200);
    expect(shape(undone.body)).toEqual(shape(before));
  });

  it('is single-level: a second undo answers 409 nothing_to_undo', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    await seedRichDay(agent, csrf, userId);
    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);
    expect((await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`)).status).toBe(200);

    const again = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('nothing_to_undo');
  });

  it('answers 409 on a date that never carried a destructive action', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    await seedTarget(userId, '2026-01-01');
    const res = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/undo`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('nothing_to_undo');
  });

  it('never crosses tenants: another user cannot undo my day', async () => {
    const owner = await authedAgent(app, 'frank');
    await seedRichDay(owner.agent, owner.csrf, owner.userId);
    await csrfPost(owner.agent, owner.csrf, `/api/v1/days/${TODAY}/clear`);

    const stranger = await authedAgent(app, 'grace');
    await seedTarget(stranger.userId, '2026-01-01');
    const res = await csrfPost(stranger.agent, stranger.csrf, `/api/v1/days/${TODAY}/undo`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('nothing_to_undo');

    // And the owner's point is untouched by the stranger's attempt.
    expect((await csrfPost(owner.agent, owner.csrf, `/api/v1/days/${TODAY}/undo`)).status).toBe(
      200,
    );
  });
});
