import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent } from './helpers.js';

// B-292: the read-only Ciqual catalog behind the Aliments screen's second mode.
// The catalog itself is seeded once by the global setup (the real 3 400 entries) and survives
// the per-file TRUNCATE, which only clears app_user; so these tests pin known Ciqual codes
// rather than counting rows.
const app = createApp();

/** Two stable 2025 entries, used as fixtures: FR/EN names differ enough to prove D6. */
const APPLE_FR = 'Pomme, chair et peau, crue';
const APPLE_EN = 'Apple, flesh and skin, raw';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('food reference catalog — browse (B-292)', () => {
  it('requires a session', async () => {
    const res = await request(app).get('/api/v1/food-refs');
    expect(res.status).toBe(401);
  });

  it('finds an entry by its FRENCH name, accent-insensitively', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/food-refs').query({ q: 'pomme, chair et peau' });
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: { name_fr: string }) => r.name_fr);
    expect(names).toContain(APPLE_FR);
  });

  it('finds the SAME entry by its English name (D6 — one query, both languages)', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/food-refs').query({ q: 'apple, flesh and skin' });
    expect(res.status).toBe(200);
    const hit = res.body.data.find((r: { name_eng: string }) => r.name_eng === APPLE_EN);
    expect(hit).toBeTruthy();
    // Both languages travel on the row: the client picks, the server does not choose for it.
    expect(hit.name_fr).toBe(APPLE_FR);
  });

  it('carries the whole FoodRef payload', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/food-refs').query({ q: 'pomme, chair et peau', limit: 1 });
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      code: expect.any(String),
      name_fr: expect.any(String),
      name_eng: expect.any(String),
      group_label_fr: expect.any(String),
      group_label_eng: expect.any(String),
      kcal_per_100g: expect.any(Number),
      fat_per_100g: expect.any(Number),
      carb_per_100g: expect.any(Number),
      protein_per_100g: expect.any(Number),
      energy_derived: expect.any(Boolean),
      already_owned: false,
    });
  });
});

describe('food reference catalog — filter, sort, paging (B-292)', () => {
  it('rejects a sort key the catalog does not offer', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/food-refs').query({ sort: 'rating' });
    expect(res.status).toBe(422);
  });

  it('filters by food group, and lists the groups that exist', async () => {
    const { agent } = await authedAgent(app, 'alice');

    const groups = await agent.get('/api/v1/food-refs/groups');
    expect(groups.status).toBe(200);
    // The 11 Anses level-1 groups + the "non classé" label of ciqual-catalog.md §5.
    expect(groups.body.data).toHaveLength(12);
    expect(groups.body.data).toContain('non classé');

    const group = 'produits céréaliers';
    expect(groups.body.data).toContain(group);
    const filtered = await agent.get('/api/v1/food-refs').query({ group, limit: 5 });
    expect(filtered.body.total).toBeGreaterThan(0);
    for (const row of filtered.body.data) expect(row.group_label_fr).toBe(group);
  });

  it('sorts by name and by kcal, both directions', async () => {
    const { agent } = await authedAgent(app, 'alice');

    const asc = await agent.get('/api/v1/food-refs').query({ sort: 'kcal', dir: 'asc', limit: 5 });
    const kcalAsc = asc.body.data.map((r: { kcal_per_100g: number }) => r.kcal_per_100g);
    expect([...kcalAsc].sort((a: number, b: number) => a - b)).toEqual(kcalAsc);

    const desc = await agent
      .get('/api/v1/food-refs')
      .query({ sort: 'kcal', dir: 'desc', limit: 5 });
    const kcalDesc = desc.body.data.map((r: { kcal_per_100g: number }) => r.kcal_per_100g);
    expect([...kcalDesc].sort((a: number, b: number) => b - a)).toEqual(kcalDesc);

    const byName = await agent.get('/api/v1/food-refs').query({ sort: 'name', limit: 3 });
    const fr = byName.body.data.map((r: { name_fr: string }) => r.name_fr);
    expect([...fr].sort((a: string, b: string) => a.localeCompare(b, 'fr'))).toEqual(fr);
  });

  it('pages by cursor, with a stable total', async () => {
    const { agent } = await authedAgent(app, 'alice');

    const page1 = await agent.get('/api/v1/food-refs').query({ limit: 10 });
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.next_cursor).toBeTruthy();

    const page2 = await agent
      .get('/api/v1/food-refs')
      .query({ limit: 10, cursor: page1.body.next_cursor });
    expect(page2.body.data).toHaveLength(10);
    // Independent of limit/cursor (00-conventions §List behaviour).
    expect(page2.body.total).toBe(page1.body.total);

    const ids1 = (page1.body.data as { id: string }[]).map((r) => r.id);
    const ids2 = (page2.body.data as { id: string }[]).map((r) => r.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });
});

// `already_owned` is the one user-scoped fact in this resource, so it is the one that has to
// prove its scoping (D11: marked, never blocking).
type Row = { name_fr: string; name_eng: string; already_owned: boolean };
type TestAgent = Awaited<ReturnType<typeof authedAgent>>['agent'];

async function appleRow(agent: TestAgent): Promise<Row> {
  const res = await agent.get('/api/v1/food-refs').query({ q: 'pomme, chair et peau', limit: 20 });
  const rows = res.body.data as Row[];
  return rows.find((r) => r.name_fr === APPLE_FR) as Row;
}

describe('food reference catalog — already_owned (B-292)', () => {
  it('is true once the user owns an active food of that name', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    expect((await appleRow(agent)).already_owned).toBe(false);

    const created = await agent.post('/api/v1/foods').set('x-csrf-token', csrf).send({
      name: APPLE_FR,
      kcal_per_100g: 54,
      fat_per_100g: 0.1,
      carb_per_100g: 11.3,
      protein_per_100g: 0.3,
      source: 'ciqual',
    });
    expect(created.status).toBe(201);

    expect((await appleRow(agent)).already_owned).toBe(true);
  });

  it('goes back to false when that food is archived', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const created = await agent.post('/api/v1/foods').set('x-csrf-token', csrf).send({
      name: APPLE_FR,
      kcal_per_100g: 54,
      fat_per_100g: 0.1,
      carb_per_100g: 11.3,
      protein_per_100g: 0.3,
    });
    expect((await appleRow(agent)).already_owned).toBe(true);

    await agent
      .post(`/api/v1/foods/${created.body.data.id as string}/archive`)
      .set('x-csrf-token', csrf);

    expect((await appleRow(agent)).already_owned).toBe(false);
  });

  it("never leaks across tenants — another user's food does not mark the entry", async () => {
    const alice = await authedAgent(app, 'alice');
    await alice.agent.post('/api/v1/foods').set('x-csrf-token', alice.csrf).send({
      name: APPLE_FR,
      kcal_per_100g: 54,
      fat_per_100g: 0.1,
      carb_per_100g: 11.3,
      protein_per_100g: 0.3,
    });
    expect((await appleRow(alice.agent)).already_owned).toBe(true);

    const bob = await authedAgent(app, 'bob');
    expect((await appleRow(bob.agent)).already_owned).toBe(false);
  });
});

// D6 says an adopted food takes its name in the UI language of the moment, so the probe must
// ask about the name that WOULD be created — not about the French one in an English UI.
describe('food reference catalog — already_owned follows the locale (B-292)', () => {
  it('asks about the name the CURRENT locale would create (D6)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    // The user owns the ENGLISH name only.
    await agent.post('/api/v1/foods').set('x-csrf-token', csrf).send({
      name: APPLE_EN,
      kcal_per_100g: 54,
      fat_per_100g: 0.1,
      carb_per_100g: 11.3,
      protein_per_100g: 0.3,
    });

    const fr = await agent.get('/api/v1/food-refs').query({ q: 'pomme, chair et peau', limit: 20 });
    const frRow = fr.body.data.find((r: { name_fr: string }) => r.name_fr === APPLE_FR);
    expect(frRow.already_owned).toBe(false); // a French adoption would not collide

    const en = await agent
      .get('/api/v1/food-refs')
      .query({ q: 'apple, flesh and skin', locale: 'en', limit: 20 });
    const enRow = en.body.data.find((r: { name_eng: string }) => r.name_eng === APPLE_EN);
    expect(enRow.already_owned).toBe(true); // an English adoption would
  });
});
