import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// Everything about `food.source` on the Aliments resource: how a provenance is written (B-290),
// then filtered, sorted and reported back as a facet (B-291/B-295). Split out of foods.test.ts,
// which the 300-line rule had outgrown. Same local harness as that file.
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

/** Seed a user, log them in, and return a cookie-primed agent + CSRF token. */
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
      .send({ name: 'Crème allégée', kcal_per_100g: 150 });
    expect(patched.status).toBe(200);
    // The rename applied; the provenance did not move. B-295 later made `source` patchable, but
    // only when the client actually sends it — editing values never rewrites it as a side effect.
    expect(patched.body.data).toMatchObject({ name: 'Crème allégée', source: 'chronodrive' });
  });
});

// B-291/B-295: the provenance becomes a real list dimension — filter, sort, and the facet the
// client needs to know which Source chips are worth offering.
/** One food per client-declarable provenance, named so A→Z and source order differ. */
async function seedThreeSources(agent: Agent, csrf: string): Promise<void> {
  await createFood(agent, csrf, { ...sampleFood, name: 'Aaa manuel' });
  await createFood(agent, csrf, { ...sampleFood, name: 'Bbb ciqual', source: 'ciqual' });
  await createFood(agent, csrf, { ...sampleFood, name: 'Ccc chrono', source: 'chronodrive' });
}

describe('foods — source filter & sort (B-291)', () => {
  it('filters the list down to one provenance, and `total` follows', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await seedThreeSources(agent, csrf);

    const all = await agent.get('/api/v1/foods');
    expect(all.body.total).toBe(3);

    const ciqual = await agent.get('/api/v1/foods').query({ source: 'ciqual' });
    expect(ciqual.status).toBe(200);
    expect(ciqual.body.data).toHaveLength(1);
    expect(ciqual.body.data[0].name).toBe('Bbb ciqual');
    expect(ciqual.body.total).toBe(1);
  });

  it('refuses `recipe` as a filter value rather than exposing recipe-derived foods', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await seedThreeSources(agent, csrf);

    const res = await agent.get('/api/v1/foods').query({ source: 'recipe' });
    expect(res.status).toBe(422);
  });

  it('sorts by provenance in both directions', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await seedThreeSources(agent, csrf);

    const asc = await agent.get('/api/v1/foods').query({ sort: 'source', dir: 'asc' });
    expect(asc.body.data.map((f: { source: string }) => f.source)).toEqual([
      'chronodrive',
      'ciqual',
      'manual',
    ]);
    const desc = await agent.get('/api/v1/foods').query({ sort: 'source', dir: 'desc' });
    expect(desc.body.data.map((f: { source: string }) => f.source)).toEqual([
      'manual',
      'ciqual',
      'chronodrive',
    ]);
  });
});

// The facet is what lets the client offer a Source chip only when a food carries that
// provenance — and hide the filter block entirely below two (B-295).
describe('foods — source facet (B-295)', () => {
  it('reports the provenances present, ignoring the query\u2019s own filters', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await seedThreeSources(agent, csrf);

    const plain = await agent.get('/api/v1/foods');
    expect(plain.body.sources).toEqual(['chronodrive', 'ciqual', 'manual']);

    // Narrowing the list must NOT narrow the facet: the client's chips would otherwise
    // disappear as the user types, and picking one would strand them on an empty list.
    const filtered = await agent.get('/api/v1/foods').query({ source: 'ciqual', q: 'Bbb' });
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.sources).toEqual(['chronodrive', 'ciqual', 'manual']);
  });

  it('counts archived foods in the facet but never recipe-derived ones', async () => {
    const { agent, csrf } = await authedAgent('alice');
    await createFood(agent, csrf, { ...sampleFood, name: 'Aaa manuel' });
    const adopted = await createFood(agent, csrf, {
      ...sampleFood,
      name: 'Bbb ciqual',
      source: 'ciqual',
    });
    // A saved recipe writes a derived food with source='recipe' into the same table.
    const recipe = await agent
      .post('/api/v1/recipes')
      .set('x-csrf-token', csrf)
      .send({ name: 'Gratin', servings: 4, total_batch_grams: 400, ingredients: [] });
    expect(recipe.status).toBe(201);

    await agent
      .post(`/api/v1/foods/${adopted.body.data.id as string}/archive`)
      .set('x-csrf-token', csrf);

    const res = await agent.get('/api/v1/foods');
    expect(res.body.data).toHaveLength(1); // the archived one is out of the LIST...
    expect(res.body.sources).toEqual(['ciqual', 'manual']); // ...but still in the FACET
    expect(res.body.sources).not.toContain('recipe');
  });

  it('lets the user correct a provenance from the food form, and only to a legal value', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const created = await createFood(agent, csrf, sampleFood);
    const id = created.body.data.id as string;
    expect(created.body.data.source).toBe('manual');

    const patched = await agent
      .patch(`/api/v1/foods/${id}`)
      .set('x-csrf-token', csrf)
      .send({ source: 'ciqual' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.source).toBe('ciqual');

    const illegal = await agent
      .patch(`/api/v1/foods/${id}`)
      .set('x-csrf-token', csrf)
      .send({ source: 'recipe' });
    expect(illegal.status).toBe(422);
  });

  it('applies the filter on the usage sort path too, total included', async () => {
    // `sort=usage` ranks in memory on its own code path. It shares buildWhere with the keyset
    // path, so a filter added to one must reach the other — and the count with it.
    const { agent, csrf } = await authedAgent('alice');
    await seedThreeSources(agent, csrf);

    const byUsage = await agent.get('/api/v1/foods').query({ sort: 'usage', source: 'ciqual' });
    expect(byUsage.body.data).toHaveLength(1);
    expect(byUsage.body.total).toBe(1);
    expect(byUsage.body.sources).toEqual(['chronodrive', 'ciqual', 'manual']);
  });
});
