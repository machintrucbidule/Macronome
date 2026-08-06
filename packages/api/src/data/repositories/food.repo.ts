import type { Food as FoodModel, FoodPortion as FoodPortionModel, Prisma } from '@prisma/client';
import type { FoodListQuery } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { pageStartIndex, pageWindow } from './page-window.js';
import { foodUsageMap, rankByUsage } from './food-usage.js';

// Repository for food + food_portion. Every method is scoped by the authenticated
// `userId` (CLAUDE.md rule 3); a cross-tenant id simply resolves to null → 404 at
// the controller. No business logic here — the service computes normalized_name,
// warnings, and DTO shape. Portions are read/written explicitly (no Prisma relation).

// `usage` is the food's 90-day consumed-meal-log count (FU-1/B-151). It is attached on every
// `GET /foods` list response, on all sorts (B-156); single-food reads keep it absent.
export type FoodWithPortions = FoodModel & { portions: FoodPortionModel[]; usage?: number };

export interface FoodWriteData {
  name: string;
  normalizedName: string;
  kcalPer100g: number;
  fatPer100g: number;
  carbPer100g: number;
  proteinPer100g: number;
  comment: string | null;
  rating: number | null;
  visibility: string;
  /** Provenance (B-290); create-only — `update` never touches it. */
  source: string;
  aiProposable: boolean;
  portions: { label: string; grams: number }[];
}

/** Map the `sort` query field to its column; id is always the tiebreak. `usage` has no column
 *  (derived at query time) and is handled by a separate ranking path. */
const SORT_COLUMN: Record<Exclude<FoodListQuery['sort'], 'usage'>, keyof FoodModel> = {
  name: 'name',
  kcal: 'kcalPer100g',
  fat: 'fatPer100g',
  carb: 'carbPer100g',
  protein: 'proteinPer100g',
  rating: 'rating',
  source: 'source',
  visibility: 'visibility',
};

/** Unrated foods sink to the bottom whichever way Note is sorted (B-299 follow-up). Postgres
 *  defaults to NULLS FIRST on DESC, which filled the first page of "Note ↓" with « Pas noté »
 *  rows — the opposite of the best-first the descending click promises. `rating` is the only
 *  nullable sortable column on this table. */
function orderFor(column: keyof FoodModel, dir: 'asc' | 'desc') {
  return column === 'rating' ? { sort: dir, nulls: 'last' as const } : dir;
}

/** Recipe-derived foods (source='recipe') live on the Recettes screen and the combined
 *  /search/loggable, never in the Aliments catalog (spec/api §Foods). */
const BROWSABLE: Prisma.StringFilter<'Food'> = { not: 'recipe' };

function buildWhere(userId: string, q: ListQuery): Prisma.FoodWhereInput {
  const where: Prisma.FoodWhereInput = { ownerId: userId, source: BROWSABLE };
  if (!q.include_archived) where.archivedAt = null;
  if (q.visibility) where.visibility = q.visibility;
  // Overwrites the BROWSABLE guard on the SAME key — safe only because the accepted filter
  // vocabulary (manual|ciqual|chronodrive, FoodListQuerySchema) can never be 'recipe'. Widen
  // that enum and this silently starts exposing recipe-derived foods: compose, don't replace.
  if (q.source) where.source = q.source;
  if (q.min_rating) where.rating = { gte: q.min_rating }; // excludes Bof(0) and unrated(null)
  if (q.normalized) where.normalizedName = { contains: q.normalized };
  return where;
}

/** Columns to write on a patch: only the provided ones (undefined = leave unchanged), while
 *  `comment: null` is meaningful and must reach the row. Extracted from `update` so the
 *  transaction body stays one statement rather than a wall of conditional spreads. */
function patchColumns(data: Partial<FoodWriteData>): Prisma.FoodUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.normalizedName !== undefined ? { normalizedName: data.normalizedName } : {}),
    ...(data.kcalPer100g !== undefined ? { kcalPer100g: data.kcalPer100g } : {}),
    ...(data.fatPer100g !== undefined ? { fatPer100g: data.fatPer100g } : {}),
    ...(data.carbPer100g !== undefined ? { carbPer100g: data.carbPer100g } : {}),
    ...(data.proteinPer100g !== undefined ? { proteinPer100g: data.proteinPer100g } : {}),
    ...(data.comment !== undefined ? { comment: data.comment } : {}),
    ...(data.rating !== undefined ? { rating: data.rating } : {}),
    ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
    ...(data.source !== undefined ? { source: data.source } : {}),
    ...(data.aiProposable !== undefined ? { aiProposable: data.aiProposable } : {}),
  };
}

/** Attach each food's portions in one extra query (ordered for stable display). */
async function withPortions(foods: FoodModel[]): Promise<FoodWithPortions[]> {
  if (foods.length === 0) return [];
  const portions = await prisma.foodPortion.findMany({
    where: { foodId: { in: foods.map((f) => f.id) } },
    orderBy: [{ label: 'asc' }],
  });
  const byFood = new Map<string, FoodPortionModel[]>();
  for (const p of portions) {
    const list = byFood.get(p.foodId);
    if (list) list.push(p);
    else byFood.set(p.foodId, [p]);
  }
  return foods.map((f) => ({ ...f, portions: byFood.get(f.id) ?? [] }));
}

/** Persist a food's named portions **id-stably** (B-113). A portion is identified by its
 *  `label` (UNIQUE(food_id,label)), so an unchanged label KEEPS its row id — references to it
 *  (pantry_item / meal_entry `portion_id`, both `ON DELETE SET NULL`) survive an edit that only
 *  touches OTHER portions. Only genuinely-removed labels are deleted (correctly nulling their
 *  refs); grams are updated in place. Renaming a label is remove+add → a new id, by design. */
async function syncPortions(
  tx: Prisma.TransactionClient,
  foodId: string,
  portions: { label: string; grams: number }[],
): Promise<void> {
  const existing = await tx.foodPortion.findMany({
    where: { foodId },
    select: { id: true, label: true },
  });
  const incoming = new Set(portions.map((p) => p.label));
  const removed = existing.filter((e) => !incoming.has(e.label));
  if (removed.length > 0)
    await tx.foodPortion.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } });
  const idByLabel = new Map(existing.map((e) => [e.label, e.id]));
  for (const p of portions) {
    const id = idByLabel.get(p.label);
    if (id) await tx.foodPortion.update({ where: { id }, data: { grams: p.grams } });
    else await tx.foodPortion.create({ data: { foodId, label: p.label, grams: p.grams } });
  }
}

/** `q.normalized` is the pre-normalized search term, injected by the service. */
type ListQuery = FoodListQuery & { normalized?: string };

/** Usage-sorted list (FU-1/B-151): rank the full match set by 90-day usage, then paginate by
 *  slicing the deterministic order (no DB column for usage). Rows carry the count. The match set
 *  is a single user's bounded catalog, like the AI candidate read. This path never was keyset, so
 *  `offset` is simply where the slice starts (LD-1/B-303). */
async function listByUsage(userId: string, query: ListQuery): Promise<ListPage> {
  const matches = await prisma.food.findMany({ where: buildWhere(userId, query) });
  const usage = await foodUsageMap(
    userId,
    matches.map((f) => f.id),
  );
  const ranked = rankByUsage(matches, usage, query.dir);
  const begin = pageStartIndex(query, () => ranked.findIndex((f) => f.id === query.cursor));
  const page = ranked.slice(begin, begin + query.limit);
  const nextCursor = begin + query.limit < ranked.length ? (page.at(-1)?.id ?? null) : null;
  const rows = await withPortions(page);
  return {
    rows: rows.map((r) => ({ ...r, usage: usage.get(r.id)?.count ?? 0 })),
    nextCursor,
    // Free here: this path already materialises every match to rank it.
    total: ranked.length,
  };
}

/** A page of the list plus how many rows match the query overall (B-278). */
interface ListPage {
  rows: FoodWithPortions[];
  nextCursor: string | null;
  total: number;
}

export const foodRepo = {
  async list(userId: string, query: ListQuery): Promise<ListPage> {
    if (query.sort === 'usage') return listByUsage(userId, query);
    const column = SORT_COLUMN[query.sort];
    const orderBy: Prisma.FoodOrderByWithRelationInput[] = [
      { [column]: orderFor(column, query.dir) },
      { id: query.dir },
    ];
    const where = buildWhere(userId, query);
    // B-278: the same predicate, counted — how many rows match regardless of limit/cursor. The
    // client reserves the height of the rows not yet loaded and shows the figure in the toolbar.
    const [foods, total] = await Promise.all([
      prisma.food.findMany({
        where,
        orderBy,
        take: query.limit + 1,
        ...pageWindow(query),
      }),
      prisma.food.count({ where }),
    ]);
    const hasMore = foods.length > query.limit;
    const page = hasMore ? foods.slice(0, query.limit) : foods;
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;
    // Always attach the 90-day consumed-usage count (B-156). Computed for the page's ids only —
    // the page is already paginated, so this is a bounded lookup, not a full-catalog scan.
    const usage = await foodUsageMap(
      userId,
      page.map((f) => f.id),
    );
    const rows = await withPortions(page);
    return {
      rows: rows.map((r) => ({ ...r, usage: usage.get(r.id)?.count ?? 0 })),
      nextCursor,
      total,
    };
  },

  /**
   * The provenance values present in the user's browsable catalog, sorted (B-295). Deliberately
   * takes NO filters: the client's Source filter must offer a stable set that does not shift
   * while the user types, so archived foods count too. `recipe` is excluded like everywhere else.
   */
  async distinctSources(userId: string): Promise<string[]> {
    const groups = await prisma.food.groupBy({
      by: ['source'],
      where: { ownerId: userId, source: BROWSABLE },
    });
    return groups.map((g) => g.source).sort();
  },

  async findById(userId: string, id: string): Promise<FoodWithPortions | null> {
    const food = await prisma.food.findFirst({ where: { id, ownerId: userId } });
    if (!food) return null;
    return (await withPortions([food]))[0] ?? null;
  },

  /** True if an active (non-archived) food of the same normalized name already exists. */
  async existsActiveByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeId?: string,
  ): Promise<boolean> {
    const match = await prisma.food.findFirst({
      where: {
        ownerId: userId,
        normalizedName,
        archivedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return match !== null;
  },

  /**
   * Which of `names` the user already has as an ACTIVE food, as normalized names (B-292).
   * One query per catalog page rather than one per row — and it lives here, not in
   * `food-ref.repo`, precisely because it is the user-scoped half of the catalog view.
   */
  async activeNormalizedNames(userId: string, names: string[]): Promise<Set<string>> {
    if (names.length === 0) return new Set();
    const rows = await prisma.food.findMany({
      where: { ownerId: userId, archivedAt: null, normalizedName: { in: names } },
      select: { normalizedName: true },
    });
    return new Set(rows.map((r) => r.normalizedName));
  },

  /**
   * The user's ACTIVE food of that normalized name, or null (B-293). `existsActiveByNormalizedName`
   * only answers yes/no; an idempotent adoption has to hand the caller the food that already
   * exists rather than create a second one.
   */
  async findActiveByNormalizedName(
    userId: string,
    normalizedName: string,
  ): Promise<FoodWithPortions | null> {
    const food = await prisma.food.findFirst({
      where: { ownerId: userId, normalizedName, archivedAt: null },
    });
    if (!food) return null;
    return (await withPortions([food]))[0] ?? null;
  },

  async create(userId: string, data: FoodWriteData): Promise<FoodWithPortions> {
    const food = await prisma.$transaction(async (tx) => {
      const created = await tx.food.create({
        data: {
          ownerId: userId,
          name: data.name,
          normalizedName: data.normalizedName,
          kcalPer100g: data.kcalPer100g,
          fatPer100g: data.fatPer100g,
          carbPer100g: data.carbPer100g,
          proteinPer100g: data.proteinPer100g,
          comment: data.comment,
          rating: data.rating,
          visibility: data.visibility,
          source: data.source,
          aiProposable: data.aiProposable,
        },
      });
      if (data.portions.length > 0) {
        await tx.foodPortion.createMany({
          data: data.portions.map((p) => ({ foodId: created.id, label: p.label, grams: p.grams })),
        });
      }
      return created;
    });
    return (await withPortions([food]))[0]!;
  },

  /** Patch an existing food (and replace its portions). Returns null if not owned. */
  async update(
    userId: string,
    id: string,
    data: Partial<FoodWriteData>,
  ): Promise<FoodWithPortions | null> {
    const owned = await prisma.food.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!owned) return null;
    await prisma.$transaction(async (tx) => {
      await tx.food.update({ where: { id }, data: patchColumns(data) });
      if (data.portions) await syncPortions(tx, id, data.portions);
    });
    return this.findById(userId, id);
  },

  /** Soft delete / restore. Returns false if not owned. */
  async setArchived(userId: string, id: string, archived: boolean): Promise<boolean> {
    const result = await prisma.food.updateMany({
      where: { id, ownerId: userId },
      data: { archivedAt: archived ? new Date() : null },
    });
    return result.count > 0;
  },
};
