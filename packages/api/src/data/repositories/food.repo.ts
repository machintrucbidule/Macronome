import type { Food as FoodModel, FoodPortion as FoodPortionModel, Prisma } from '@prisma/client';
import type { FoodListQuery } from '@macronome/shared';
import { prisma } from '../prisma.js';

// Repository for food + food_portion. Every method is scoped by the authenticated
// `userId` (CLAUDE.md rule 3); a cross-tenant id simply resolves to null → 404 at
// the controller. No business logic here — the service computes normalized_name,
// warnings, and DTO shape. Portions are read/written explicitly (no Prisma relation).

export type FoodWithPortions = FoodModel & { portions: FoodPortionModel[] };

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
  portions: { label: string; grams: number }[];
}

/** Map the `sort` query field to its column; id is always the tiebreak. */
const SORT_COLUMN: Record<FoodListQuery['sort'], keyof FoodModel> = {
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

/** `q.normalized` is the pre-normalized search term, injected by the service. */
type ListQuery = FoodListQuery & { normalized?: string };

export const foodRepo = {
  async list(
    userId: string,
    query: ListQuery,
  ): Promise<{ rows: FoodWithPortions[]; nextCursor: string | null }> {
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
        },
      });
      if (data.portions) {
        await tx.foodPortion.deleteMany({ where: { foodId: id } });
        if (data.portions.length > 0) {
          await tx.foodPortion.createMany({
            data: data.portions.map((p) => ({ foodId: id, label: p.label, grams: p.grams })),
          });
        }
      }
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
