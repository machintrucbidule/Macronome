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

// ai_proposable (B-123 / AI meal-proposals S2): foods are eligible for AI proposals by
// default; the flag round-trips through create/update/read and backfills via the DB default.
describe('foods — ai_proposable (B-123)', () => {
  it('defaults ai_proposable to true on create and round-trips false on update', async () => {
    const { agent, csrf } = await authedAgent('alice');

    const created = await createFood(agent, csrf, sampleFood);
    expect(created.status).toBe(201);
    expect(created.body.data.ai_proposable).toBe(true);
    const id = created.body.data.id as string;

    const patched = await agent
      .patch(`/api/v1/foods/${id}`)
      .set('x-csrf-token', csrf)
      .send({ ai_proposable: false });
    expect(patched.status).toBe(200);
    expect(patched.body.data.ai_proposable).toBe(false);

    const read = await agent.get(`/api/v1/foods/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.ai_proposable).toBe(false);
  });

  it('backfills ai_proposable to true via the DB default (legacy rows)', async () => {
    const { userId } = await authedAgent('alice');
    // Insert a row without specifying aiProposable — the column DEFAULT true applies, the
    // same mechanism that backfilled existing rows on ADD COLUMN (feature D9).
    const row = await prisma.food.create({
      data: {
        ownerId: userId,
        name: 'Legacy food',
        normalizedName: 'legacy food',
        kcalPer100g: 100,
        fatPer100g: 1,
        carbPer100g: 1,
        proteinPer100g: 1,
      },
      select: { aiProposable: true },
    });
    expect(row.aiProposable).toBe(true);
  });
});

describe('foods — parse-label (PM-1/B-114)', () => {
  function parse(agent: Agent, csrf: string, label_text: string) {
    return agent.post('/api/v1/foods/parse-label').set('x-csrf-token', csrf).send({ label_text });
  }

  it('parses a pasted nutrition table into per-100 g macros (no persistence)', async () => {
    const { agent, csrf, userId } = await authedAgent('alice');
    const res = await parse(
      agent,
      csrf,
      'pour 100 g/100 ml\n1 510 kj/362 kcal 18 %/18 %\nMatières grasses 15 g\nGlucides 32 g\nProtéines 34 g',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      kcal_per_100g: 362,
      fat_per_100g: 15,
      carb_per_100g: 32,
      protein_per_100g: 34,
    });
    expect(res.body.warnings).toBeUndefined();
    // Stateless: nothing written.
    expect(await prisma.food.count({ where: { ownerId: userId } })).toBe(0);
  });

  it('rejects a reconstituted "après préparation" label with 422', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const res = await parse(agent, csrf, 'pour 100 ml etat après préparation\n154 kj/37 kcal');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('reconstituted_label');
  });
});

// B-290: `food.source` was declared, CHECK-constrained and exposed, but never written — every
// food landed as 'manual', including the ones built from a Chronodrive product. The create
// endpoint now takes the provenance the client declares, and only the values a client may claim.
describe('foods — source provenance (B-290)', () => {
  it('persists a client-declared provenance', async () => {
    const { agent, csrf } = await authedAgent('alice');

    const created = await createFood(agent, csrf, { ...sampleFood, source: 'chronodrive' });
    expect(created.status).toBe(201);
    expect(created.body.data.source).toBe('chronodrive');

    const read = await agent.get(`/api/v1/foods/${created.body.data.id as string}`);
    expect(read.body.data.source).toBe('chronodrive');
  });

  it('accepts ciqual and defaults to manual when nothing is declared', async () => {
    const { agent, csrf } = await authedAgent('alice');

    const adopted = await createFood(agent, csrf, {
      ...sampleFood,
      name: 'Blé dur',
      source: 'ciqual',
    });
    expect(adopted.status).toBe(201);
    expect(adopted.body.data.source).toBe('ciqual');

    const typed = await createFood(agent, csrf, { ...sampleFood, name: 'Yaourt' });
    expect(typed.body.data.source).toBe('manual');
  });

  it('rejects the server-owned `recipe` provenance', async () => {
    const { agent, csrf } = await authedAgent('alice');

    const res = await createFood(agent, csrf, { ...sampleFood, source: 'recipe' });
    expect(res.status).toBe(422);
  });

  it('keeps the provenance when the food is edited afterwards (D7)', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const created = await createFood(agent, csrf, { ...sampleFood, source: 'chronodrive' });
    const id = created.body.data.id as string;

    const patched = await agent
      .patch(`/api/v1/foods/${id}`)
      .set('x-csrf-token', csrf)
      .send({ name: 'Crème allégée', kcal_per_100g: 150, source: 'manual' });
    expect(patched.status).toBe(200);
    // The rename applied; the provenance did not move (PATCH has no `source` field at all).
    expect(patched.body.data).toMatchObject({ name: 'Crème allégée', source: 'chronodrive' });
  });
});
