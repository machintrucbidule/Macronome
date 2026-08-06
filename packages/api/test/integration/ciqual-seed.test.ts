import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/data/prisma.js';
import { normalize } from '../../src/domain/search/normalize.js';
import { seedFoodRefCatalog } from '../../src/services/ciqual-seed.js';

// B-289: the global Ciqual catalog is seeded at boot from the extract committed with the build,
// keyed on a `dataset` marker — same edition → no-op, different edition → the whole table is
// replaced in one transaction. That idempotence is what makes "automatic on upgrade" safe to
// run on every single start (spec/logic/ciqual-catalog.md §6).

afterAll(async () => {
  // Leave the shared test DB the way the global setup left it: catalog present.
  await seedFoodRefCatalog();
  await prisma.$disconnect();
});

describe('ciqual catalog seeder (B-289)', () => {
  it('fills an empty catalog and normalises both names with the food normaliser', async () => {
    await prisma.foodRef.deleteMany({});

    const first = await seedFoodRefCatalog();
    expect(first.replaced).toBe(true);
    expect(first.dataset).toBe('ciqual_2025');
    expect(await prisma.foodRef.count()).toBe(first.count);

    const row = await prisma.foodRef.findFirst({ orderBy: { code: 'asc' } });
    expect(row).not.toBeNull();
    // Parity with food.normalized_name is what the duplicate rule of the catalog view needs.
    expect(row!.normalizedNameFr).toBe(normalize(row!.nameFr));
    expect(row!.normalizedNameEng).toBe(normalize(row!.nameEng));
    expect(row!.groupLabelFr).not.toBe('');
  });

  it('is a no-op when the stored edition already matches', async () => {
    const seeded = await seedFoodRefCatalog();
    const before = await prisma.foodRef.findFirst({ orderBy: { code: 'asc' } });

    // A local edit survives: proof nothing was rewritten, not merely that the count matched.
    await prisma.foodRef.update({ where: { id: before!.id }, data: { nameFr: 'SENTINEL' } });
    const again = await seedFoodRefCatalog();

    expect(again.replaced).toBe(false);
    expect(again.count).toBe(seeded.count);
    const after = await prisma.foodRef.findUnique({ where: { id: before!.id } });
    expect(after?.nameFr).toBe('SENTINEL');
  });

  it('replaces the whole table when the stored edition differs', async () => {
    await seedFoodRefCatalog();
    await prisma.$executeRawUnsafe(`UPDATE "food_ref" SET "dataset" = 'ciqual_2020'`);

    const replaced = await seedFoodRefCatalog();

    expect(replaced.replaced).toBe(true);
    expect(replaced.dataset).toBe('ciqual_2025');
    expect(await prisma.foodRef.count({ where: { dataset: 'ciqual_2020' } })).toBe(0);
    expect(await prisma.foodRef.count({ where: { dataset: 'ciqual_2025' } })).toBe(replaced.count);
  });

  it('stores only non-negative macros and a unique code per edition', async () => {
    await seedFoodRefCatalog();

    const negatives = await prisma.foodRef.count({
      where: {
        OR: [
          { kcalPer100g: { lt: 0 } },
          { fatPer100g: { lt: 0 } },
          { carbPer100g: { lt: 0 } },
          { proteinPer100g: { lt: 0 } },
        ],
      },
    });
    expect(negatives).toBe(0);

    const codes = await prisma.foodRef.findMany({ select: { code: true } });
    expect(new Set(codes.map((c) => c.code)).size).toBe(codes.length);
  });
});
