import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, type Agent } from './helpers.js';

// LD-1/B-303 follow-up: an Aliments row is TALLER when it draws the comment sub-line, so a client
// reserving height for rows it has not loaded cannot average the ones it holds — the first page is
// not representative. `GET /foods` therefore reports how many of the matching rows carry a comment,
// on the same predicate as `total`.
//
// The predicate has one trap these tests exist for: an empty string is storable and draws NO
// sub-line (`FoodRow` renders `{food.comment && …}`), so `IS NOT NULL` alone over-counts.
const app = createApp();

function addFood(agent: Agent, csrf: string, name: string, comment: string | null) {
  return csrfPost(agent, csrf, '/api/v1/foods', {
    name,
    kcal_per_100g: 100,
    fat_per_100g: 1,
    carb_per_100g: 2,
    protein_per_100g: 3,
    comment,
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /foods → with_comment (B-303 follow-up)', () => {
  it('counts only the rows that actually draw a comment', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await addFood(agent, csrf, 'Avec A', 'note A');
    await addFood(agent, csrf, 'Avec B', 'note B');
    await addFood(agent, csrf, 'Sans', null);
    // The trap: stored, non-null, but falsy in the row — it draws no sub-line.
    await addFood(agent, csrf, 'Vide', '');

    const res = await agent.get('/api/v1/foods');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.with_comment).toBe(2);
  });

  it('is 0 when nothing carries a comment', async () => {
    const { agent, csrf } = await authedAgent(app, 'bob');
    await addFood(agent, csrf, 'Sans 1', null);
    await addFood(agent, csrf, 'Sans 2', null);
    const res = await agent.get('/api/v1/foods');
    expect(res.body.with_comment).toBe(0);
  });

  it('honours the query filters, exactly like total', async () => {
    const { agent, csrf } = await authedAgent(app, 'carol');
    await addFood(agent, csrf, 'Pomme notée', 'sucrée');
    await addFood(agent, csrf, 'Poire notée', 'juteuse');
    await addFood(agent, csrf, 'Pomme nue', null);

    const all = await agent.get('/api/v1/foods');
    expect(all.body.total).toBe(3);
    expect(all.body.with_comment).toBe(2);

    // Search narrows both figures together — the count must describe the SAME set as `total`,
    // otherwise the reserve is computed against rows that are not in the list.
    const filtered = await agent.get('/api/v1/foods').query({ q: 'pomme' });
    expect(filtered.body.total).toBe(2);
    expect(filtered.body.with_comment).toBe(1);
  });

  it('is identical on every page, whichever way the page was addressed', async () => {
    const { agent, csrf } = await authedAgent(app, 'dave');
    for (let i = 0; i < 6; i += 1) {
      await addFood(agent, csrf, `Aliment ${String(i)}`, i % 2 === 0 ? `note ${String(i)}` : null);
    }
    const page1 = await agent.get('/api/v1/foods').query({ limit: 2 });
    const byCursor = await agent
      .get('/api/v1/foods')
      .query({ limit: 2, cursor: page1.body.next_cursor as string });
    const byOffset = await agent.get('/api/v1/foods').query({ limit: 2, offset: 4 });

    expect(page1.body.with_comment).toBe(3);
    expect(byCursor.body.with_comment).toBe(3);
    expect(byOffset.body.with_comment).toBe(3);
  });

  it('is reported on the usage-sort path too, which paginates in memory', async () => {
    const { agent, csrf } = await authedAgent(app, 'erin');
    await addFood(agent, csrf, 'Avec', 'note');
    await addFood(agent, csrf, 'Sans', null);
    const res = await agent.get('/api/v1/foods').query({ sort: 'usage', dir: 'desc' });
    expect(res.body.total).toBe(2);
    expect(res.body.with_comment).toBe(1);
  });
});
