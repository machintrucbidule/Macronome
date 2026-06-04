import type { FoodPortion as FoodPortionModel } from '@prisma/client';
import type { LoggableItem } from '@macronome/shared';
import { prisma } from '../prisma.js';

// Combined log search (spec/api/foods-recipes.md §"Combined log search"). Diacritic-
// insensitive autocomplete over the user's active foods AND recipe-derived foods (the
// derived foods are `food` rows with source='recipe'). Archived rows are excluded; the
// recipe archive/restore also toggles its derived food so archived recipes drop out here.

const num = (d: { toString(): string }): number => Number(d.toString());

export const loggableRepo = {
  async search(
    userId: string,
    normalized: string | undefined,
    limit: number,
  ): Promise<LoggableItem[]> {
    const foods = await prisma.food.findMany({
      where: {
        ownerId: userId,
        archivedAt: null,
        ...(normalized ? { normalizedName: { contains: normalized } } : {}),
      },
      orderBy: [{ name: 'asc' }],
      take: limit,
    });
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
    return foods.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.source === 'recipe' ? 'recipe' : 'food',
      recipe_id: f.source === 'recipe' ? f.recipeId : null,
      named_portions: (byFood.get(f.id) ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        grams: num(p.grams),
      })),
    }));
  },
};
