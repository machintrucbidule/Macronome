import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, seedFood, type Agent } from './helpers.js';

// RS-1/B-306: every Recettes column sorts. kcal/L/G/P live on the recipe's derived food and
// g/portion is an expression (batch / servings), so none of the five has a column to ORDER BY —
// the repository ranks the whole match set in memory instead, like the Aliments «Utilisation»
// sort. What these cases pin: the five orderings, that a recipe computing 0 is ordered ON that 0
// (the rule the owner chose over "no macros ⇒ last", since NULLS-LAST belongs to `rating` alone),
// and that the ranked order slices coherently under both `offset` and `cursor` (LD-1/B-303).
const app = createApp();

const names = (res: { body: { data: { name: string }[] } }): string[] =>
  res.body.data.map((r) => r.name);

/** One recipe = 100 g of one food in a 100 g batch, so its per-100 g macros ARE the food's. */
async function seedRecipes(agent: Agent, csrf: string, userId: string): Promise<void> {
  const table = [
    ['Haute', { kcal: 300, fat: 30, carb: 5, protein: 1 }, 1, 3],
    ['Moyenne', { kcal: 200, fat: 10, carb: 20, protein: 5 }, 2, 1],
    ['Basse', { kcal: 100, fat: 1, carb: 40, protein: 9 }, 4, null],
    // Computes to zero everywhere and is a real recipe all the same — a herbal tea.
    ['Tisane', { kcal: 0, fat: 0, carb: 0, protein: 0 }, 5, 0],
  ] as const;
  for (const [name, per100g, servings, rating] of table) {
    const food = await seedFood(userId, `Ingrédient ${name}`, per100g);
    const res = await csrfPost(agent, csrf, '/api/v1/recipes', {
      name,
      servings,
      total_batch_grams: 100,
      rating,
      ingredients: [
        { ref_type: 'food', ref_id: food.id, quantity: 100, unit: 'g', order_index: 0 },
      ],
    });
    expect(res.status).toBe(201);
  }
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recipes — the derived macro columns and g/portion sort (B-306)', () => {
  // Expected descending order per sort key; ascending is the exact reverse here (no ties).
  const cases = [
    ['kcal', ['Haute', 'Moyenne', 'Basse', 'Tisane']],
    ['fat', ['Haute', 'Moyenne', 'Basse', 'Tisane']],
    ['carb', ['Basse', 'Moyenne', 'Haute', 'Tisane']],
    ['protein', ['Basse', 'Moyenne', 'Haute', 'Tisane']],
    // batch is identical on all four, so this one orders purely on servings: 100/1 … 100/5.
    ['weight_per_portion', ['Haute', 'Moyenne', 'Basse', 'Tisane']],
  ] as const;

  it.each(cases)('sorts by %s in both directions', async (sort, expected) => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedRecipes(agent, csrf, userId);

    const desc = await agent.get('/api/v1/recipes').query({ sort, dir: 'desc' });
    expect(desc.status).toBe(200);
    expect(names(desc)).toEqual([...expected]);

    const asc = await agent.get('/api/v1/recipes').query({ sort, dir: 'asc' });
    expect(names(asc)).toEqual([...expected].reverse());
  });

  it('orders a zero-macro recipe on its zero, not at the bottom of both directions', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'bob');
    await seedRecipes(agent, csrf, userId);

    // The owner's decision (RS-1/B-306, superseding the triage proposal D26): a computed 0 is an
    // ordinary value — it closes the descending sort and OPENS the ascending one. Burying it in
    // both would hide a real measurement. NULLS-LAST stays scoped to `rating`.
    const asc = await agent.get('/api/v1/recipes').query({ sort: 'kcal', dir: 'asc' });
    expect(names(asc)[0]).toBe('Tisane');
    const desc = await agent.get('/api/v1/recipes').query({ sort: 'kcal', dir: 'desc' });
    expect(names(desc).at(-1)).toBe('Tisane');

    // Contrast, unchanged: an unrated recipe sinks whichever way Note is sorted (B-299).
    const rated = await agent.get('/api/v1/recipes').query({ sort: 'rating', dir: 'desc' });
    expect(names(rated).at(-1)).toBe('Basse');
    const ratedAsc = await agent.get('/api/v1/recipes').query({ sort: 'rating', dir: 'asc' });
    expect(names(ratedAsc).at(-1)).toBe('Basse');
  });

  it('paginates the ranked order without duplicating or dropping a row', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'carol');
    await seedRecipes(agent, csrf, userId);
    const q = { sort: 'carb', dir: 'desc' as const, limit: 2 };

    const p0 = await agent.get('/api/v1/recipes').query({ ...q, offset: 0 });
    const p1 = await agent.get('/api/v1/recipes').query({ ...q, offset: 2 });
    expect([...names(p0), ...names(p1)]).toEqual(['Basse', 'Moyenne', 'Haute', 'Tisane']);
    expect(p0.body.total).toBe(4);
    expect(p1.body.total).toBe(4);
  });

  it('lands on the page a cursor walk reaches — the LD-1 invariant, on a ranked sort', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'dave');
    await seedRecipes(agent, csrf, userId);
    const q = { sort: 'protein', dir: 'desc' as const, limit: 2 };

    const first = await agent.get('/api/v1/recipes').query(q);
    const walked = await agent
      .get('/api/v1/recipes')
      .query({ ...q, cursor: first.body.next_cursor as string });
    const jumped = await agent.get('/api/v1/recipes').query({ ...q, offset: 2 });
    expect(names(jumped)).toEqual(names(walked));
    expect(jumped.body.next_cursor).toBeNull();
  });

  it('honours the filters and reports the matching total on the ranked path', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'erin');
    await seedRecipes(agent, csrf, userId);

    const search = await agent.get('/api/v1/recipes').query({ sort: 'kcal', q: 'tisane' });
    expect(names(search)).toEqual(['Tisane']);
    expect(search.body.total).toBe(1);

    // min_rating ≥ 1 excludes Bof(0) — Tisane — and unrated — Basse.
    const rated = await agent
      .get('/api/v1/recipes')
      .query({ sort: 'kcal', dir: 'desc', min_rating: 1 });
    expect(names(rated)).toEqual(['Haute', 'Moyenne']);
    expect(rated.body.total).toBe(2);

    await prisma.recipe.updateMany({ where: { name: 'Haute' }, data: { archivedAt: new Date() } });
    const active = await agent.get('/api/v1/recipes').query({ sort: 'kcal', dir: 'desc' });
    expect(names(active)).toEqual(['Moyenne', 'Basse', 'Tisane']);
    expect(active.body.total).toBe(3);
    const all = await agent
      .get('/api/v1/recipes')
      .query({ sort: 'kcal', dir: 'desc', include_archived: true });
    expect(names(all)).toEqual(['Haute', 'Moyenne', 'Basse', 'Tisane']);
  });
});
