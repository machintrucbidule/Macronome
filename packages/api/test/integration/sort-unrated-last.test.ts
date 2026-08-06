import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// B-299 follow-up: sorting by Note descending is supposed to open on the best-rated rows. Postgres
// orders NULLS FIRST on DESC, so it opened on every « Pas noté » row instead — the exact opposite,
// and indistinguishable from the ascending sort the item set out to fix. Unrated rows must sink to
// the bottom whichever way Note is sorted, on Aliments AND on Recettes (the only two nullable
// sortable columns in the app).
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

describe('Note sort keeps unrated rows last (B-299)', () => {
  it('lists foods best-rated first on dir=desc, unrated at the bottom', async () => {
    const { agent, csrf } = await authedAgent('alice');
    // Created unrated-first on purpose: insertion order must not be what saves the assertion.
    for (const [name, rating] of [
      ['Sans note', null],
      ['Bof', 0],
      ['Top', 3],
      ['Moyen', 1],
    ] as const) {
      await agent
        .post('/api/v1/foods')
        .set('x-csrf-token', csrf)
        .send({ name, ...macros, rating });
    }

    const desc = await agent.get('/api/v1/foods').query({ sort: 'rating', dir: 'desc' });
    expect(desc.status).toBe(200);
    expect(desc.body.data.map((f: { name: string }) => f.name)).toEqual([
      'Top',
      'Moyen',
      'Bof',
      'Sans note',
    ]);

    // Ascending is unchanged: worst graded first, unrated still last.
    const asc = await agent.get('/api/v1/foods').query({ sort: 'rating', dir: 'asc' });
    expect(asc.body.data.map((f: { name: string }) => f.name)).toEqual([
      'Bof',
      'Moyen',
      'Top',
      'Sans note',
    ]);
  });

  it('lists recipes best-rated first on dir=desc, unrated at the bottom', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const food = await agent
      .post('/api/v1/foods')
      .set('x-csrf-token', csrf)
      .send({ name: 'Farine', ...macros });
    const foodId = food.body.data.id as string;

    for (const [name, rating] of [
      ['Recette sans note', null],
      ['Recette top', 3],
      ['Recette moyenne', 1],
    ] as const) {
      await agent
        .post('/api/v1/recipes')
        .set('x-csrf-token', csrf)
        .send({
          name,
          servings: 2,
          total_batch_grams: 500,
          rating,
          ingredients: [
            { ref_type: 'food', ref_id: foodId, quantity: 100, unit: 'g', order_index: 0 },
          ],
        });
    }

    const desc = await agent.get('/api/v1/recipes').query({ sort: 'rating', dir: 'desc' });
    expect(desc.status).toBe(200);
    expect(desc.body.data.map((r: { name: string }) => r.name)).toEqual([
      'Recette top',
      'Recette moyenne',
      'Recette sans note',
    ]);
  });
});
