import type { Food as FoodModel, FoodPortion as FoodPortionModel } from '@prisma/client';
import { prisma } from '../prisma.js';
import { DERIVED_PORTION_LABEL } from '../../domain/recipes/derive.js';
import type { MacroPer100g } from '../../domain/serving/serving.js';

// Persistence + resolution reads for a recipe's derived food (spec/logic/
// recipes-derived-food.md §5). The derived food is a `food` row (source='recipe',
// recipe_id → recipe) with one auto "portion" named portion. Saving a recipe upserts it.
// Resolution reads turn ingredient references (foods or nested recipes) into per-100 g
// macros + names + portions for aggregation and the builder DTO. User-scoped throughout.

const num = (d: { toString(): string }): number => Number(d.toString());

export interface ResolvedFood {
  id: string;
  name: string;
  per100g: MacroPer100g;
  portions: { id: string; label: string; grams: number }[];
}

function toResolved(food: FoodModel, portions: FoodPortionModel[]): ResolvedFood {
  return {
    id: food.id,
    name: food.name,
    per100g: {
      kcal: num(food.kcalPer100g),
      fat: num(food.fatPer100g),
      carb: num(food.carbPer100g),
      protein: num(food.proteinPer100g),
    },
    portions: portions.map((p) => ({ id: p.id, label: p.label, grams: num(p.grams) })),
  };
}

export interface DerivedSummary {
  foodId: string;
  per100g: MacroPer100g;
  portionGrams: number;
}

export const recipeDerivedFoodRepo = {
  /** Resolve foods (with portions) by id for the active user. */
  async foodsByIds(userId: string, ids: string[]): Promise<Map<string, ResolvedFood>> {
    const out = new Map<string, ResolvedFood>();
    if (ids.length === 0) return out;
    const foods = await prisma.food.findMany({ where: { id: { in: ids }, ownerId: userId } });
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
    for (const f of foods) out.set(f.id, toResolved(f, byFood.get(f.id) ?? []));
    return out;
  },

  /** Map each recipe id → its derived food id (for nested-recipe ingredient resolution). */
  async derivedFoodIdByRecipeIds(
    userId: string,
    recipeIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (recipeIds.length === 0) return out;
    const foods = await prisma.food.findMany({
      where: { ownerId: userId, source: 'recipe', recipeId: { in: recipeIds } },
      select: { id: true, recipeId: true },
    });
    for (const f of foods) if (f.recipeId) out.set(f.recipeId, f.id);
    return out;
  },

  /** Per-100 g macros + auto "portion" grams of each recipe's derived food (list summary). */
  async derivedSummariesByRecipeIds(
    userId: string,
    recipeIds: string[],
  ): Promise<Map<string, DerivedSummary>> {
    const out = new Map<string, DerivedSummary>();
    if (recipeIds.length === 0) return out;
    const foods = await prisma.food.findMany({
      where: { ownerId: userId, source: 'recipe', recipeId: { in: recipeIds } },
    });
    const portions = await prisma.foodPortion.findMany({
      where: { foodId: { in: foods.map((f) => f.id) }, label: DERIVED_PORTION_LABEL },
    });
    const gramsByFood = new Map(portions.map((p) => [p.foodId, num(p.grams)]));
    for (const f of foods) {
      if (!f.recipeId) continue;
      out.set(f.recipeId, {
        foodId: f.id,
        per100g: {
          kcal: num(f.kcalPer100g),
          fat: num(f.fatPer100g),
          carb: num(f.carbPer100g),
          protein: num(f.proteinPer100g),
        },
        portionGrams: gramsByFood.get(f.id) ?? 0,
      });
    }
    return out;
  },

  /** Soft delete / restore a recipe's derived food alongside the recipe (search hygiene). */
  async setArchivedByRecipe(userId: string, recipeId: string, archived: boolean): Promise<void> {
    await prisma.food.updateMany({
      where: { ownerId: userId, source: 'recipe', recipeId },
      data: { archivedAt: archived ? new Date() : null },
    });
  },

  /** (Re)build the derived food for a recipe. Returns the derived food id. */
  async upsert(
    userId: string,
    recipeId: string,
    name: string,
    normalizedName: string,
    per100g: MacroPer100g,
    portionGrams: number,
  ): Promise<string> {
    const macros = {
      name,
      normalizedName,
      kcalPer100g: per100g.kcal,
      fatPer100g: per100g.fat,
      carbPer100g: per100g.carb,
      proteinPer100g: per100g.protein,
    };
    return prisma.$transaction(async (tx) => {
      const existing = await tx.food.findFirst({
        where: { ownerId: userId, source: 'recipe', recipeId },
        select: { id: true },
      });
      if (existing) {
        await tx.food.update({ where: { id: existing.id }, data: macros });
        await tx.foodPortion.deleteMany({ where: { foodId: existing.id } });
        await tx.foodPortion.create({
          data: { foodId: existing.id, label: DERIVED_PORTION_LABEL, grams: portionGrams },
        });
        return existing.id;
      }
      const created = await tx.food.create({
        data: { ownerId: userId, source: 'recipe', recipeId, visibility: 'private', ...macros },
      });
      await tx.foodPortion.create({
        data: { foodId: created.id, label: DERIVED_PORTION_LABEL, grams: portionGrams },
      });
      return created.id;
    });
  },
};
