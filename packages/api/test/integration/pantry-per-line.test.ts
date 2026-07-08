import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, seedTarget, type Agent } from './helpers.js';

// B-198 — per-line garde-manger pin. A food pinned to a meal that is manually re-added as a
// second line must be a NORMAL line (not pinned, not swept), the duplicate's pin control is
// its own, deleting/unpinning the garde-manger line unpins the food (reference-counted), and
// "Tout effacer" deletes the duplicate but keeps-and-zeroes the placeholder.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = '2026-12-01';
const SLOT = 'Petit déjeuner';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const breakfastOf = (body: {
  meals: {
    slot_name: string;
    id: string;
    entries: { id: string; is_pinned: boolean; served_quantity: number }[];
  }[];
}) => body.meals.find((m) => m.slot_name === SLOT)!;

/** Pin `food` to breakfast (settings), materialize TODAY, and return the breakfast meal id +
 *  its garde-manger placeholder line id. */
async function pinnedBreakfast(agent: Agent, csrf: string, userId: string, foodId: string) {
  await seedTarget(userId, '2026-01-01');
  await csrfPost(agent, csrf, '/api/v1/pantry', { meal_slot_name: SLOT, food_id: foodId });
  const day = await csrfPost(agent, csrf, `/api/v1/days/${TODAY}`);
  const b = breakfastOf(day.body);
  return { mealId: b.id, placeholderId: b.entries[0]!.id };
}

const addDuplicate = (agent: Agent, csrf: string, mealId: string, foodId: string, qty = 2) =>
  csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries`, {
    kind: 'referenced',
    food_id: foodId,
    served_quantity: qty,
    unit: 'g',
  });

describe('B-198 — per-line garde-manger pin', () => {
  it('a manually re-added line of a pinned food is a NORMAL line (is_pinned:false)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId } = await pinnedBreakfast(agent, csrf, userId, food.id);

    const dup = await addDuplicate(agent, csrf, mealId, food.id);
    expect(dup.body.is_pinned).toBe(false);

    const b = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(b.entries).toHaveLength(2);
    const placeholder = b.entries.find((e) => e.served_quantity === 0)!;
    const duplicate = b.entries.find((e) => e.served_quantity === 2)!;
    expect(placeholder.is_pinned).toBe(true); // the garde-manger line
    expect(duplicate.is_pinned).toBe(false); // the re-added serving
  });

  it('unpinning the food leaves the normal duplicate and deletes only the placeholder', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId, placeholderId } = await pinnedBreakfast(agent, csrf, userId, food.id);
    await addDuplicate(agent, csrf, mealId, food.id);

    // Unpin via the placeholder's 📌 → reference count = 0 (the duplicate isn't pinned) → wipe.
    const res = await csrfPost(
      agent,
      csrf,
      `/api/v1/meals/${mealId}/entries/${placeholderId}/unpin`,
    );
    expect(res.status).toBe(200);

    const b = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(b.entries).toHaveLength(1); // placeholder gone, duplicate survives
    expect(b.entries[0]).toMatchObject({ served_quantity: 2, is_pinned: false });
    // The food left the garde-manger — a brand-new day no longer prefills it.
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE}`)).body).entries).toHaveLength(0);
  });

  it('unpinning/deleting the duplicate never touches the placeholder or the pin', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId } = await pinnedBreakfast(agent, csrf, userId, food.id);
    const dup = await addDuplicate(agent, csrf, mealId, food.id);

    // Delete the (non-pinned) duplicate — the food stays pinned, placeholder untouched.
    await agent.delete(`/api/v1/meals/${mealId}/entries/${dup.body.id}`).set('x-csrf-token', csrf);

    const b = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(b.entries).toHaveLength(1);
    expect(b.entries[0]).toMatchObject({ served_quantity: 0, is_pinned: true });
    expect((await agent.get('/api/v1/pantry')).body.data).toHaveLength(1); // still pinned
  });

  it('reference count — the food stays pinned until the last pinned line is unpinned', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId, placeholderId } = await pinnedBreakfast(agent, csrf, userId, food.id);
    const dup = await addDuplicate(agent, csrf, mealId, food.id);

    // Pin the duplicate too → two pinned lines, one pantry row.
    const pinned = await csrfPost(
      agent,
      csrf,
      `/api/v1/meals/${mealId}/entries/${dup.body.id}/pin`,
    );
    expect(pinned.body.is_pinned).toBe(true);
    expect((await agent.get('/api/v1/pantry')).body.data).toHaveLength(1);

    // Unpin ONE (the duplicate) → the food stays pinned (the placeholder keeps it).
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${dup.body.id}/unpin`);
    const b = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(b.entries.find((e) => e.id === placeholderId)!.is_pinned).toBe(true);
    expect((await agent.get('/api/v1/pantry')).body.data).toHaveLength(1);
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE}`)).body).entries).toHaveLength(1);

    // Unpin the LAST one (the placeholder) → the food leaves the garde-manger.
    await csrfPost(agent, csrf, `/api/v1/meals/${mealId}/entries/${placeholderId}/unpin`);
    expect((await agent.get('/api/v1/pantry')).body.data).toHaveLength(0);
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE}`)).body).entries).toHaveLength(0);
  });

  it('deleting the sole garde-manger line unpins the food (× = unpin)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId, placeholderId } = await pinnedBreakfast(agent, csrf, userId, food.id);

    await agent
      .delete(`/api/v1/meals/${mealId}/entries/${placeholderId}`)
      .set('x-csrf-token', csrf);

    expect((await agent.get('/api/v1/pantry')).body.data).toHaveLength(0);
    expect(breakfastOf((await agent.get(`/api/v1/days/${FUTURE}`)).body).entries).toHaveLength(0);
  });

  it('"Tout effacer" deletes the normal duplicate but keeps-and-zeroes the placeholder', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const food = await seedFood(userId, 'Œuf');
    const { mealId } = await pinnedBreakfast(agent, csrf, userId, food.id);
    await addDuplicate(agent, csrf, mealId, food.id);

    await csrfPost(agent, csrf, `/api/v1/days/${TODAY}/clear`);

    const b = breakfastOf((await agent.get(`/api/v1/days/${TODAY}`)).body);
    expect(b.entries).toHaveLength(1); // duplicate deleted, placeholder kept
    expect(b.entries[0]).toMatchObject({ served_quantity: 0, is_pinned: true });
  });
});
