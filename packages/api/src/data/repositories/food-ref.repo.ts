import { prisma } from '../prisma.js';

// Repository for the global Ciqual reference catalog (spec/schema/tables-catalog.md → food_ref).
//
// DOCUMENTED EXCEPTION to CLAUDE.md rule 3 (`docs/architecture/security.md` §6): `food_ref` holds
// no user data — no owner_id, no per-user rows, nothing a user ever wrote — so its methods take
// no `userId`. There is no tenant to scope to, and a fake one would only hide that. The exception
// is scoped to global reference data; any method here that ever touches user data takes `userId`
// like every other repository.
//
// The only writer is the boot seeder (services/ciqual-seed.ts). Requests only read.

/** One row to insert, already normalized by the seeder. */
export interface FoodRefSeedRow {
  dataset: string;
  code: string;
  nameFr: string;
  nameEng: string;
  normalizedNameFr: string;
  normalizedNameEng: string;
  groupLabelFr: string;
  groupLabelEng: string;
  kcalPer100g: number;
  fatPer100g: number;
  carbPer100g: number;
  proteinPer100g: number;
  energyDerived: boolean;
}

/** Insert in chunks: one 3 400-row createMany would build a single oversized statement. */
const INSERT_CHUNK = 500;

/** The edition currently stored, or null when the catalog is empty. */
export async function currentDataset(): Promise<string | null> {
  const row = await prisma.foodRef.findFirst({ select: { dataset: true } });
  return row?.dataset ?? null;
}

/** How many reference entries are stored (all editions — there is only ever one). */
export async function count(): Promise<number> {
  return prisma.foodRef.count();
}

/**
 * Replace the whole catalog with `rows`, in one transaction: either the new edition is fully
 * in place or nothing changed. Callers must have decided the edition actually differs.
 */
export async function replaceAll(rows: FoodRefSeedRow[]): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.foodRef.deleteMany({});
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        await tx.foodRef.createMany({ data: rows.slice(i, i + INSERT_CHUNK) });
      }
    },
    { timeout: 60_000 },
  );
}
