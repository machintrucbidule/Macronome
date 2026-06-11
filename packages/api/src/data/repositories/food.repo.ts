import type { Food as FoodModel, FoodPortion as FoodPortionModel, Prisma } from '@prisma/client';
import type { FoodListQuery } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { foodUsageMap, rankByUsage } from './food-usage.js';

// Repository for food + food_portion. Every method is scoped by the authenticated
// `userId` (CLAUDE.md rule 3); a cross-tenant id simply resolves to null → 404 at
// the controller. No business logic here — the service computes normalized_name,
// warnings, and DTO shape. Portions are read/written explicitly (no Prisma relation).

// `usage` is attached only on a `sort=usage` list (FU-1/B-151) — the 90-day meal-log count.
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
  visibility: 'visibility',
};

function buildWhere(userId: string, q: ListQuery): Prisma.FoodWhereInput {
  // Browse foods only — recipe-derived foods (source='recipe') live on the Recettes
  // screen and the combined /search/loggable, not the Aliments catalog (spec/api §Foods).
  const where: Prisma.FoodWhereInput = { ownerId: userId, source: { not: 'recipe' } };
  if (!q.include_archived) where.archivedAt = null;
  if (q.visibility) where.visibility = q.visibility;
  if (q.min_rating) where.rating = { gte: q.min_rating }; // excludes Bof(0) and unrated(null)
  if (q.normalized) where.normalizedName = { contains: q.normalized };
  return where;
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
 *  cursor-id slicing over the deterministic order (no DB column for usage). Rows carry the count.
 *  The match set is a single user's bounded catalog, like the AI candidate read. */
async function listByUsage(
  userId: string,
  query: ListQuery,
): Promise<{ rows: FoodWithPortions[]; nextCursor: string | null }> {
  const matches = await prisma.food.findMany({ where: buildWhere(userId, query) });
  const usage = await foodUsageMap(
    userId,
    matches.map((f) => f.id),
  );
  const ranked = rankByUsage(matches, usage, query.dir);
  const after = query.cursor ? ranked.findIndex((f) => f.id === query.cursor) : -1;
  const begin = after >= 0 ? after + 1 : 0;
  const page = ranked.slice(begin, begin + query.limit);
  const nextCursor = begin + query.limit < ranked.length ? (page.at(-1)?.id ?? null) : null;
  const rows = await withPortions(page);
  return {
    rows: rows.map((r) => ({ ...r, usage: usage.get(r.id)?.count ?? 0 })),
    nextCursor,
  };
}

export const foodRepo = {
  async list(
    userId: string,
    query: ListQuery,
  ): Promise<{ rows: FoodWithPortions[]; nextCursor: string | null }> {
    if (query.sort === 'usage') return listByUsage(userId, query);
    const column = SORT_COLUMN[query.sort];
    const orderBy: Prisma.FoodOrderByWithRelationInput[] = [
      { [column]: query.dir },
      { id: query.dir },
    ];
    const foods = await prisma.food.findMany({
      where: buildWhere(userId, query),
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = foods.length > query.limit;
    const page = hasMore ? foods.slice(0, query.limit) : foods;
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;
    return { rows: await withPortions(page), nextCursor };
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
      await tx.food.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.normalizedName !== undefined ? { normalizedName: data.normalizedName } : {}),
          ...(data.kcalPer100g !== undefined ? { kcalPer100g: data.kcalPer100g } : {}),
          ...(data.fatPer100g !== undefined ? { fatPer100g: data.fatPer100g } : {}),
          ...(data.carbPer100g !== undefined ? { carbPer100g: data.carbPer100g } : {}),
          ...(data.proteinPer100g !== undefined ? { proteinPer100g: data.proteinPer100g } : {}),
          ...(data.comment !== undefined ? { comment: data.comment } : {}),
          ...(data.rating !== undefined ? { rating: data.rating } : {}),
          ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
          ...(data.aiProposable !== undefined ? { aiProposable: data.aiProposable } : {}),
        },
      });
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
