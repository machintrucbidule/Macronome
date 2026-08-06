import type { FoodRef as FoodRefModel, Prisma } from '@prisma/client';
import type { FoodRefListQuery } from '@macronome/shared';
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

/** Sort key → column, per locale: `name` follows the language, the macros do not. */
const SORT_COLUMN: Record<
  FoodRefListQuery['locale'],
  Record<FoodRefListQuery['sort'], keyof FoodRefModel>
> = {
  fr: {
    name: 'nameFr',
    kcal: 'kcalPer100g',
    fat: 'fatPer100g',
    carb: 'carbPer100g',
    protein: 'proteinPer100g',
  },
  en: {
    name: 'nameEng',
    kcal: 'kcalPer100g',
    fat: 'fatPer100g',
    carb: 'carbPer100g',
    protein: 'proteinPer100g',
  },
};

/** The group-label column of a locale — also what `GET /food-refs/groups` lists. */
function groupColumn(locale: FoodRefListQuery['locale']): 'groupLabelFr' | 'groupLabelEng' {
  return locale === 'en' ? 'groupLabelEng' : 'groupLabelFr';
}

type ListOpts = FoodRefListQuery & { normalized?: string };

function buildWhere(q: ListOpts): Prisma.FoodRefWhereInput {
  const where: Prisma.FoodRefWhereInput = {};
  // D6: one query matches both languages, so "pomme" and "apple" find the same entry.
  if (q.normalized) {
    where.OR = [
      { normalizedNameFr: { contains: q.normalized } },
      { normalizedNameEng: { contains: q.normalized } },
    ];
  }
  if (q.group) where[groupColumn(q.locale)] = q.group;
  return where;
}

export interface FoodRefPage {
  rows: FoodRefModel[];
  nextCursor: string | null;
  total: number;
}

/** One keyset page of the catalog. Same convention as `food.repo.list` (00-conventions §List). */
export async function list(query: ListOpts): Promise<FoodRefPage> {
  const column = SORT_COLUMN[query.locale][query.sort];
  const where = buildWhere(query);
  const [rows, total] = await Promise.all([
    prisma.foodRef.findMany({
      where,
      orderBy: [{ [column]: query.dir }, { id: query.dir }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    prisma.foodRef.count({ where }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return { rows: page, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null, total };
}

/** One entry by id, for adoption (B-293). Null when the id is unknown. */
export async function findById(id: string): Promise<FoodRefModel | null> {
  return prisma.foodRef.findUnique({ where: { id } });
}

/**
 * A bounded name search for the combined log picker (B-293) — the reference tail appended under
 * the user's own results. Unlike `list` it has no cursor and runs no `count`: the picker shows at
 * most a handful of rows and never pages.
 */
export async function searchByName(
  normalized: string,
  locale: FoodRefListQuery['locale'],
  limit: number,
): Promise<FoodRefModel[]> {
  if (limit <= 0) return [];
  return prisma.foodRef.findMany({
    where: {
      OR: [
        { normalizedNameFr: { contains: normalized } },
        { normalizedNameEng: { contains: normalized } },
      ],
    },
    orderBy: [{ [SORT_COLUMN[locale].name]: 'asc' }, { id: 'asc' }],
    take: limit,
  });
}

/** The level-1 group labels present, sorted — the catalog's group filter (B-292). */
export async function groups(locale: FoodRefListQuery['locale']): Promise<string[]> {
  const column = groupColumn(locale);
  const found = await prisma.foodRef.groupBy({ by: [column] });
  return found.map((g) => g[column]).sort((a, b) => a.localeCompare(b, locale));
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
