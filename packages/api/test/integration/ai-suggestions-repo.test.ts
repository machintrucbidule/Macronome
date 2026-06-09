import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/data/prisma.js';
import { aiSuggestionsRepo } from '../../src/data/repositories/ai-suggestions.repo.js';

// Integration checks for the AI meal-suggestions read layer (spec/logic/ai-meal-suggestions.md
// §3 candidate pool, §4 OK-day history). Seeds rows directly (no default "Rien" food) for full
// control over rating / ai_proposable / source / archive / verdict. Runs against the
// compose.test.yml Postgres. All reads are user-scoped (CLAUDE.md rule 3).

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const toUtc = (d: string): Date => new Date(`${d}T00:00:00.000Z`);
const snap = (calMin: number, calMax: number) => ({
  cal_min: calMin,
  cal_max: calMax,
  protein_floor_g: null,
  fat_floor_g: null,
  carb_ceiling_g: null,
});

let seq = 0;
function mkUser(): Promise<{ id: string }> {
  seq += 1;
  return prisma.appUser.create({
    data: {
      username: `u${seq}`,
      passwordHash: 'x',
      sex: 'male',
      birthdate: new Date('1990-01-01'),
      heightCm: 180,
    },
    select: { id: true },
  });
}

interface FoodOpts {
  rating?: number | null;
  aiProposable?: boolean;
  source?: string;
  archived?: boolean;
  per100g?: { kcal: number; fat: number; carb: number; protein: number };
  portions?: { label: string; grams: number }[];
}

async function mkFood(userId: string, name: string, opts: FoodOpts = {}): Promise<string> {
  const p = opts.per100g ?? { kcal: 100, fat: 1, carb: 2, protein: 20 };
  const food = await prisma.food.create({
    data: {
      ownerId: userId,
      name,
      normalizedName: name.toLowerCase(),
      kcalPer100g: p.kcal,
      fatPer100g: p.fat,
      carbPer100g: p.carb,
      proteinPer100g: p.protein,
      rating: opts.rating ?? null,
      aiProposable: opts.aiProposable ?? true,
      source: opts.source ?? 'manual',
      archivedAt: opts.archived ? new Date() : null,
    },
    select: { id: true },
  });
  for (const portion of opts.portions ?? [])
    await prisma.foodPortion.create({ data: { foodId: food.id, ...portion } });
  return food.id;
}

interface SeedEntry {
  foodId?: string;
  customName?: string;
  snapKcal: number;
  servedGrams: number;
}

/** Seed a detailed day with the given band and meals/entries. */
async function seedDay(
  userId: string,
  date: string,
  band: [number, number],
  meals: { slot: string; entries: SeedEntry[] }[],
): Promise<void> {
  const day = await prisma.dayLog.create({
    data: { userId, date: toUtc(date), kind: 'detailed', targetSnapshot: snap(band[0], band[1]) },
    select: { id: true },
  });
  let order = 0;
  for (const m of meals) {
    const meal = await prisma.meal.create({
      data: { dayLogId: day.id, slotName: m.slot, orderIndex: order++ },
      select: { id: true },
    });
    let i = 0;
    for (const e of m.entries)
      await prisma.mealEntry.create({
        data: {
          mealId: meal.id,
          kind: e.customName ? 'custom' : 'referenced',
          foodId: e.foodId ?? null,
          customName: e.customName ?? null,
          unit: 'g',
          servedQuantity: e.servedGrams,
          servedGrams: e.servedGrams,
          snapKcal: e.snapKcal,
          snapFat: 0,
          snapCarb: 0,
          snapProtein: 0,
          orderIndex: i++,
        },
      });
  }
}

/** Log a single referenced entry on a date (recency-of-use seed; verdict irrelevant). */
function eat(userId: string, date: string, foodId: string): Promise<void> {
  return seedDay(
    userId,
    date,
    [1900, 2100],
    [{ slot: 'repas', entries: [{ foodId, snapKcal: 100, servedGrams: 100 }] }],
  );
}

describe('aiSuggestionsRepo.candidatePool (§3)', () => {
  it('keeps ai_proposable + rating≠0 (unrated included), excludes Bof/no-ai/archived/recipe', async () => {
    const { id: userId } = await mkUser();
    const good = await mkFood(userId, 'Poulet', {
      rating: 3,
      portions: [{ label: 'dose', grams: 30 }],
    });
    const mid = await mkFood(userId, 'Riz', { rating: 1 });
    const unrated = await mkFood(userId, 'Courgette', { rating: null });
    await mkFood(userId, 'Bonbon', { rating: 0 }); // Bof → excluded
    await mkFood(userId, 'NoAI', { rating: 2, aiProposable: false }); // opted out → excluded
    await mkFood(userId, 'Vieux', { rating: 3, archived: true }); // archived → excluded
    await mkFood(userId, 'Gratin', { rating: 3, source: 'recipe' }); // recipe → excluded

    const other = await mkUser();
    await mkFood(other.id, 'Foreign', { rating: 3 }); // tenant isolation

    const pool = await aiSuggestionsRepo.candidatePool(userId);
    expect(pool.map((f) => f.food_id).sort()).toEqual([good, mid, unrated].sort());

    const goodRow = pool.find((f) => f.food_id === good)!;
    expect(goodRow).toMatchObject({
      name: 'Poulet',
      rating: 3,
      per100g: { kcal: 100, fat: 1, carb: 2, protein: 20 },
    });
    expect(goodRow.portions).toEqual([
      { portion_id: expect.any(String), label: 'dose', grams: 30 },
    ]);
  });

  it('orders by rating desc (unrated last) then recency of use; respects the cap', async () => {
    const { id: userId } = await mkUser();
    const goodOld = await mkFood(userId, 'Boeuf', { rating: 3 });
    const goodNew = await mkFood(userId, 'Thon', { rating: 3 });
    const mid = await mkFood(userId, 'Pâtes', { rating: 1 });
    const unrated = await mkFood(userId, 'Salade', { rating: null });
    await eat(userId, '2026-05-01', goodOld);
    await eat(userId, '2026-05-10', goodNew); // more recent → ranks before goodOld

    const pool = await aiSuggestionsRepo.candidatePool(userId);
    expect(pool.map((f) => f.food_id)).toEqual([goodNew, goodOld, mid, unrated]);

    const capped = await aiSuggestionsRepo.candidatePool(userId, 2);
    expect(capped.map((f) => f.food_id)).toEqual([goodNew, goodOld]);
  });

  it('returns [] when the user has no eligible foods', async () => {
    const { id: userId } = await mkUser();
    await mkFood(userId, 'Bonbon', { rating: 0 });
    expect(await aiSuggestionsRepo.candidatePool(userId)).toEqual([]);
  });
});

describe('aiSuggestionsRepo.okDayHistory (§4)', () => {
  it('samples recent OK detailed days newest-first with foods+qty; excludes NOK/summary/≥before', async () => {
    const { id: userId } = await mkUser();
    const fx = await mkFood(userId, 'Saumon');
    const fy = await mkFood(userId, 'Brocoli');

    // OK detailed day, two meals.
    await seedDay(
      userId,
      '2026-05-20',
      [1900, 2100],
      [
        { slot: 'petit-dej', entries: [{ foodId: fx, snapKcal: 1000, servedGrams: 150 }] },
        {
          slot: 'diner',
          entries: [
            { foodId: fy, snapKcal: 1000, servedGrams: 200 },
            { customName: 'Café', snapKcal: 0, servedGrams: 0 }, // zero-qty → dropped
          ],
        },
      ],
    );
    // NOK day (kcal below band) → excluded.
    await seedDay(
      userId,
      '2026-05-15',
      [1900, 2100],
      [{ slot: 'repas', entries: [{ foodId: fx, snapKcal: 500, servedGrams: 80 }] }],
    );
    // Older OK day → included after the newer one.
    await seedDay(
      userId,
      '2026-05-10',
      [1900, 2100],
      [{ slot: 'repas', entries: [{ foodId: fx, snapKcal: 2000, servedGrams: 300 }] }],
    );
    // OK but on/after `before` → excluded by the date window.
    await seedDay(
      userId,
      '2026-05-22',
      [1900, 2100],
      [{ slot: 'repas', entries: [{ foodId: fy, snapKcal: 2000, servedGrams: 300 }] }],
    );
    // Summary OK day → excluded (carries no foods).
    await prisma.dayLog.create({
      data: {
        userId,
        date: toUtc('2026-05-18'),
        kind: 'summary',
        summaryKcal: 2000,
        targetSnapshot: snap(1900, 2100),
      },
    });
    // Another tenant's OK day → must never leak.
    const other = await mkUser();
    const of = await mkFood(other.id, 'Foreign');
    await seedDay(
      other.id,
      '2026-05-19',
      [1900, 2100],
      [{ slot: 'repas', entries: [{ foodId: of, snapKcal: 2000, servedGrams: 300 }] }],
    );

    const history = await aiSuggestionsRepo.okDayHistory(userId, '2026-05-21');

    expect(history).toEqual([
      { date_offset: -1, meal_name: 'petit-dej', foods: [{ name: 'Saumon', qty: '150 g' }] },
      { date_offset: -1, meal_name: 'diner', foods: [{ name: 'Brocoli', qty: '200 g' }] },
      { date_offset: -11, meal_name: 'repas', foods: [{ name: 'Saumon', qty: '300 g' }] },
    ]);
  });

  it('honours the limit (most recent OK days only)', async () => {
    const { id: userId } = await mkUser();
    const f = await mkFood(userId, 'Oeuf');
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03'])
      await seedDay(
        userId,
        d,
        [1900, 2100],
        [{ slot: 'repas', entries: [{ foodId: f, snapKcal: 2000, servedGrams: 100 }] }],
      );
    const history = await aiSuggestionsRepo.okDayHistory(userId, '2026-06-01', 2);
    expect(history.map((h) => h.date_offset)).toEqual([-29, -30]); // 05-03, 05-02 (newest two)
  });

  it('returns [] when the user has no OK history', async () => {
    const { id: userId } = await mkUser();
    expect(await aiSuggestionsRepo.okDayHistory(userId, '2026-06-01')).toEqual([]);
  });
});
