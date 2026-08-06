import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood } from './helpers.js';

// B-293: the combined log picker gains a tail of Ciqual reference entries under the user's own
// results, and picking one adopts it. The real catalog is seeded by the global setup and survives
// the per-file TRUNCATE (which only clears app_user), so these tests pin a known entry.
const app = createApp();

const APPLE_FR = 'Pomme, chair et peau, crue';
const APPLE_EN = 'Apple, flesh and skin, raw';

interface Item {
  id: string;
  name: string;
  kind: 'food' | 'recipe';
  origin: 'own' | 'ciqual_ref';
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function search(
  agent: Awaited<ReturnType<typeof authedAgent>>['agent'],
  query: Record<string, string>,
): Promise<Item[]> {
  const res = await agent.get('/api/v1/search/loggable').query(query);
  expect(res.status).toBe(200);
  return res.body.data as Item[];
}

describe('loggable search — the Ciqual tail (B-293)', () => {
  it('offers nothing from the catalog until something is typed', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedFood(userId, 'Pomme maison');

    // The picker opens on the user's habits, not on 3 400 alphabetical catalog rows — this is
    // also what keeps the FU-1 ordering assertions of food-usage.test.ts intact.
    const blank = await search(agent, {});
    expect(blank.every((i) => i.origin === 'own')).toBe(true);
    expect(blank).toHaveLength(1);
  });

  it('appends reference entries UNDER the user own results once a term is given', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    await seedFood(userId, 'Ma pomme, chair et peau');

    const items = await search(agent, { q: 'pomme, chair et peau' });
    expect(items[0]).toMatchObject({ name: 'Ma pomme, chair et peau', origin: 'own' });
    expect(items.length).toBeGreaterThan(1);
    // Own block first, catalog block after — never interleaved.
    const firstRef = items.findIndex((i) => i.origin === 'ciqual_ref');
    expect(firstRef).toBe(1);
    expect(items.slice(firstRef).every((i) => i.origin === 'ciqual_ref')).toBe(true);
    expect(items.map((i) => i.name)).toContain(APPLE_FR);
  });

  it('never lets the catalog displace an own result', async () => {
    const { agent, userId } = await authedAgent(app, 'alice');
    for (let i = 0; i < 5; i++) await seedFood(userId, `Pomme maison ${i}`);

    const items = await search(agent, { q: 'pomme', limit: '5' });
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.origin === 'own')).toBe(true);
  });

  it('drops a reference entry the user already owns, and offers it again once archived', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    const created = await agent.post('/api/v1/foods').set('x-csrf-token', csrf).send({
      name: APPLE_FR,
      kcal_per_100g: 54,
      fat_per_100g: 0.1,
      carb_per_100g: 11.3,
      protein_per_100g: 0.3,
    });
    expect(created.status).toBe(201);
    expect(userId).toBeTruthy();

    // Their own food wins: offering both would only invite a duplicate (D11).
    const owned = await search(agent, { q: 'pomme, chair et peau' });
    expect(owned.filter((i) => i.name === APPLE_FR)).toHaveLength(1);
    expect(owned.find((i) => i.name === APPLE_FR)?.origin).toBe('own');

    await csrfPost(agent, csrf, `/api/v1/foods/${created.body.data.id as string}/archive`);

    const afterArchive = await search(agent, { q: 'pomme, chair et peau' });
    expect(afterArchive.find((i) => i.name === APPLE_FR)?.origin).toBe('ciqual_ref');
  });

  it('returns reference names in the requested locale', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const en = await search(agent, { q: 'apple, flesh and skin', locale: 'en' });
    expect(en.map((i) => i.name)).toContain(APPLE_EN);
  });

  it('marks recipe-derived foods as own, like any other food of the user', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const recipe = await agent
      .post('/api/v1/recipes')
      .set('x-csrf-token', csrf)
      .send({ name: 'Compote pomme', servings: 4, total_batch_grams: 400, ingredients: [] });
    expect(recipe.status).toBe(201);

    const items = await search(agent, { q: 'compote' });
    const derived = items.find((i) => i.kind === 'recipe');
    expect(derived).toMatchObject({ kind: 'recipe', origin: 'own' });
  });
});

describe('POST /foods/from-ref — silent adoption (B-293)', () => {
  async function appleRefId(
    agent: Awaited<ReturnType<typeof authedAgent>>['agent'],
  ): Promise<string> {
    const res = await agent
      .get('/api/v1/food-refs')
      .query({ q: 'pomme, chair et peau', limit: 20 });
    const rows = res.body.data as { id: string; name_fr: string }[];
    return rows.find((r) => r.name_fr === APPLE_FR)!.id;
  }

  it('copies the entry with the adoption defaults', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const refId = await appleRefId(agent);

    const res = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', { ref_id: refId });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: APPLE_FR,
      kcal_per_100g: 54,
      source: 'ciqual',
      visibility: 'shared',
      ai_proposable: true,
      rating: null,
      comment: null,
      named_portions: [],
    });

    const list = await agent.get('/api/v1/foods').query({ source: 'ciqual' });
    expect(list.body.data).toHaveLength(1);
  });

  it('is idempotent — a second pick returns the same food, never a duplicate', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const refId = await appleRefId(agent);

    const first = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', { ref_id: refId });
    expect(first.status).toBe(201);
    const second = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', { ref_id: refId });
    // 200, not 201: nothing was created this time.
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);

    const list = await agent.get('/api/v1/foods');
    expect(list.body.total).toBe(1);
  });

  it('names the adopted food in the requested locale', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const refId = await appleRefId(agent);

    const res = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', {
      ref_id: refId,
      locale: 'en',
    });
    expect(res.body.data.name).toBe(APPLE_EN);
  });

  it('404s on an unknown reference id, and 422s on a malformed body', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const unknown = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', {
      ref_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(unknown.status).toBe(404);

    const malformed = await csrfPost(agent, csrf, '/api/v1/foods/from-ref', { ref_id: 'nope' });
    expect(malformed.status).toBe(422);
  });

  it('leaves the entry out of the picker once adopted, and marks it in the catalog', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const refId = await appleRefId(agent);
    await csrfPost(agent, csrf, '/api/v1/foods/from-ref', { ref_id: refId });

    const items = await search(agent, { q: 'pomme, chair et peau' });
    expect(items.filter((i) => i.name === APPLE_FR)).toHaveLength(1);
    expect(items.find((i) => i.name === APPLE_FR)?.origin).toBe('own');

    const catalog = await agent
      .get('/api/v1/food-refs')
      .query({ q: 'pomme, chair et peau', limit: 20 });
    const row = (catalog.body.data as { id: string; already_owned: boolean }[]).find(
      (r) => r.id === refId,
    );
    expect(row?.already_owned).toBe(true);
  });
});
