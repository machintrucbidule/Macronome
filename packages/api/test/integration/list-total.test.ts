import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// B-278: the paginated list envelope carries `total` — the number of rows matching the query's
// **filters**, independent of limit/cursor (spec/api/00-conventions.md §List behaviour). The client
// reserves the height of the rows it has not fetched, and shows the figure in the toolbar, so a
// total that counted the whole catalogue instead of the matches would be visibly wrong.
const app = createApp();

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!raw) return undefined;
  const escaped = name.replace(/\./g, '\\.');
  for (const cookie of raw) {
    const match = new RegExp(`${escaped}=([^;]+)`).exec(cookie);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
}

type Agent = ReturnType<typeof request.agent>;

async function authedAgent(username: string): Promise<{ agent: Agent; csrf: string }> {
  const passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  await prisma.appUser.create({
    data: { username, passwordHash, sex: 'male', birthdate: new Date('1990-01-01'), heightCm: 180 },
  });
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  const csrf = getCookie(pre, 'macronome.csrf') ?? '';
  await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrf)
    .send({ username, password: 'correct-horse' });
  return { agent, csrf };
}

const macros = { kcal_per_100g: 100, fat_per_100g: 1, carb_per_100g: 2, protein_per_100g: 3 };

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('list total — foods (B-278)', () => {
  it('counts every match, not the page — the same figure on each page', async () => {
    const { agent, csrf } = await authedAgent('alice');
    for (let i = 0; i < 5; i++) {
      await agent
        .post('/api/v1/foods')
        .set('x-csrf-token', csrf)
        .send({ name: `Aliment ${i}`, ...macros });
    }

    const page1 = await agent.get('/api/v1/foods').query({ limit: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.total).toBe(5);

    const page2 = await agent
      .get('/api/v1/foods')
      .query({ limit: 2, cursor: page1.body.next_cursor });
    expect(page2.body.data).toHaveLength(2);
    // Independent of limit and cursor: the client sizes its scrollbar on this from page 1.
    expect(page2.body.total).toBe(5);
  });

  it('follows the search filter rather than counting the catalogue', async () => {
    const { agent, csrf } = await authedAgent('alice');
    for (const name of ['Pomme', 'Poire', 'Pain']) {
      await agent
        .post('/api/v1/foods')
        .set('x-csrf-token', csrf)
        .send({ name, ...macros });
    }

    const all = await agent.get('/api/v1/foods');
    expect(all.body.total).toBe(3);

    const search = await agent.get('/api/v1/foods').query({ q: 'pom' });
    expect(search.body.data).toHaveLength(1);
    expect(search.body.total).toBe(1);
  });

  it('excludes archived foods unless they are asked for', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const created = await agent
      .post('/api/v1/foods')
      .set('x-csrf-token', csrf)
      .send({ name: 'Beurre', ...macros });
    await agent
      .post('/api/v1/foods')
      .set('x-csrf-token', csrf)
      .send({ name: 'Huile', ...macros });
    await agent
      .post(`/api/v1/foods/${created.body.data.id}/archive`)
      .set('x-csrf-token', csrf)
      .send({});

    const active = await agent.get('/api/v1/foods');
    expect(active.body.total).toBe(1);

    const withArchived = await agent.get('/api/v1/foods').query({ include_archived: 'true' });
    expect(withArchived.body.total).toBe(withArchived.body.data.length);
    expect(withArchived.body.total).toBeGreaterThan(1);
  });

  it('reports the same total on the usage sort path, which ranks in memory', async () => {
    const { agent, csrf } = await authedAgent('alice');
    for (let i = 0; i < 3; i++) {
      await agent
        .post('/api/v1/foods')
        .set('x-csrf-token', csrf)
        .send({ name: `Aliment ${i}`, ...macros });
    }

    const byName = await agent.get('/api/v1/foods').query({ sort: 'name' });
    const byUsage = await agent.get('/api/v1/foods').query({ sort: 'usage', limit: 2 });
    expect(byUsage.body.data).toHaveLength(2);
    expect(byUsage.body.total).toBe(byName.body.total);
    expect(byUsage.body.total).toBe(3);
  });
});

describe('list total — recipes (B-278)', () => {
  it('carries the total on recipes too', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const food = await agent
      .post('/api/v1/foods')
      .set('x-csrf-token', csrf)
      .send({ name: 'Farine', ...macros });
    for (const name of ['Gâteau', 'Galette']) {
      const created = await agent
        .post('/api/v1/recipes')
        .set('x-csrf-token', csrf)
        .send({
          name,
          servings: 2,
          ingredients: [
            {
              ref_type: 'food',
              ref_id: food.body.data.id,
              quantity: 100,
              unit: 'g',
              order_index: 0,
            },
          ],
        });
      expect(created.status).toBe(201);
    }

    const all = await agent.get('/api/v1/recipes');
    expect(all.body.total).toBe(2);

    const search = await agent.get('/api/v1/recipes').query({ q: 'gate' });
    expect(search.body.total).toBe(search.body.data.length);
  });
});
