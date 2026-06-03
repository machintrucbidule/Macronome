import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// Integration contract checks for the foods resource (spec/api/foods-recipes.md,
// M1 acceptance). Runs against the compose.test.yml Postgres (npm run db:dev).
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

/** Seed a user, log them in, and return a cookie-primed agent + CSRF token + id. */
async function authedAgent(
  username: string,
): Promise<{ agent: Agent; csrf: string; userId: string }> {
  const passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  await prisma.appUser.create({
    data: { username, passwordHash, sex: 'male', birthdate: new Date('1990-01-01'), heightCm: 180 },
  });
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  const csrf = getCookie(pre, 'macronome.csrf') ?? '';
  const login = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrf)
    .send({ username, password: 'correct-horse' });
  return { agent, csrf, userId: login.body.user.id as string };
}

const sampleFood = {
  name: 'Crème fraîche',
  kcal_per_100g: 292,
  fat_per_100g: 30,
  carb_per_100g: 2.9,
  protein_per_100g: 2.4,
  named_portions: [{ label: 'cuillère', grams: 15 }],
};

function createFood(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/foods').set('x-csrf-token', csrf).send(body);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('foods', () => {
  it('creates a food and finds it via diacritic-insensitive search', async () => {
    const { agent, csrf } = await authedAgent('alice');

    const created = await createFood(agent, csrf, sampleFood);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Crème fraîche',
      kcal_per_100g: 292,
      visibility: 'private',
      source: 'manual',
      rating: null,
      archived_at: null,
    });
    expect(created.body.data.named_portions).toHaveLength(1);
    expect(created.body.warnings).toBeUndefined();

    // "creme" (no accent) matches the normalized key.
    const search = await agent.get('/api/v1/foods').query({ q: 'creme' });
    expect(search.status).toBe(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].name).toBe('Crème fraîche');
  });

  it('warns (non-blocking) but still saves a duplicate active name', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await createFood(agent, csrf, sampleFood);

    const dup = await createFood(agent, csrf, { ...sampleFood, named_portions: [] });
    expect(dup.status).toBe(201);
    expect(dup.body.warnings).toEqual(['duplicate_name']);

    const list = await agent.get('/api/v1/foods');
    expect(list.body.data).toHaveLength(2); // both saved
  });

  it('removes an archived food from search/list', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const created = await createFood(agent, csrf, sampleFood);
    const id = created.body.data.id as string;

    const archived = await agent.post(`/api/v1/foods/${id}/archive`).set('x-csrf-token', csrf);
    expect(archived.status).toBe(200);

    const list = await agent.get('/api/v1/foods');
    expect(list.body.data).toHaveLength(0);

    const withArchived = await agent.get('/api/v1/foods').query({ include_archived: 'true' });
    expect(withArchived.body.data).toHaveLength(1);
    expect(withArchived.body.data[0].archived_at).not.toBeNull();
  });

  it("returns 404 for another user's food (tenancy)", async () => {
    const alice = await authedAgent('alice');
    const created = await createFood(alice.agent, alice.csrf, sampleFood);
    const id = created.body.data.id as string;

    const bob = await authedAgent('bob');
    const res = await bob.agent.get(`/api/v1/foods/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('rejects a malformed body with 422 + per-field details', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const res = await createFood(agent, csrf, {
      name: '',
      kcal_per_100g: -5,
      fat_per_100g: 30,
      carb_per_100g: 2.9,
      protein_per_100g: 2.4,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toHaveProperty('name');
    expect(res.body.error.details).toHaveProperty('kcal_per_100g');
  });
});
