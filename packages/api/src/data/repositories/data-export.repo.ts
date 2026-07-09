import type {
  Advice,
  AppUser,
  Container,
  DayLog,
  Food,
  FoodPortion,
  LeftoverGroup,
  LeftoverGroupEntry,
  Meal,
  MealEntry,
  MealSlotTemplate,
  PantryItem,
  Recipe,
  RecipeIngredient,
  Target,
  WeightEntry,
} from '@prisma/client';
import { prisma } from '../prisma.js';

// Read side of the data export (IMP-1). Pulls every user-scoped row in one pass so the
// export service can serialise a full account snapshot. User-scoped throughout (CLAUDE.md
// rule 3). Child tables carry no owner column, so they are scoped through their parents' ids.
// No business logic — the service maps rows to the snake_case envelope.

export interface ExportRows {
  user: AppUser;
  mealTemplates: MealSlotTemplate[];
  containers: Container[];
  foods: Food[];
  foodPortions: FoodPortion[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  pantryItems: PantryItem[];
  weightEntries: WeightEntry[];
  targets: Target[];
  dayLogs: DayLog[];
  meals: Meal[];
  mealEntries: MealEntry[];
  leftoverGroups: LeftoverGroup[];
  leftoverGroupEntries: LeftoverGroupEntry[];
  advices: Advice[];
}

export const dataExportRepo = {
  /** Read all of the authenticated user's rows for a full export, or null if no such user. */
  async readAll(userId: string): Promise<ExportRows | null> {
    const user = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!user) return null;

    const [
      mealTemplates,
      containers,
      foods,
      recipes,
      pantryItems,
      weightEntries,
      targets,
      dayLogs,
      advices,
    ] = await Promise.all([
      prisma.mealSlotTemplate.findMany({ where: { userId }, orderBy: { orderIndex: 'asc' } }),
      prisma.container.findMany({ where: { ownerId: userId } }),
      prisma.food.findMany({ where: { ownerId: userId } }),
      prisma.recipe.findMany({ where: { ownerId: userId } }),
      prisma.pantryItem.findMany({ where: { userId } }),
      prisma.weightEntry.findMany({ where: { userId } }),
      prisma.target.findMany({ where: { userId } }),
      prisma.dayLog.findMany({ where: { userId } }),
      prisma.advice.findMany({ where: { userId } }),
    ]);

    const foodIds = foods.map((f) => f.id);
    const recipeIds = recipes.map((r) => r.id);
    const dayLogIds = dayLogs.map((d) => d.id);

    const [foodPortions, recipeIngredients, meals] = await Promise.all([
      prisma.foodPortion.findMany({ where: { foodId: { in: foodIds } } }),
      prisma.recipeIngredient.findMany({ where: { recipeId: { in: recipeIds } } }),
      prisma.meal.findMany({ where: { dayLogId: { in: dayLogIds } } }),
    ]);

    const mealIds = meals.map((m) => m.id);
    const [mealEntries, leftoverGroups] = await Promise.all([
      prisma.mealEntry.findMany({ where: { mealId: { in: mealIds } } }),
      prisma.leftoverGroup.findMany({ where: { mealId: { in: mealIds } } }),
    ]);

    const leftoverGroupEntries = await prisma.leftoverGroupEntry.findMany({
      where: { leftoverGroupId: { in: leftoverGroups.map((g) => g.id) } },
    });

    return {
      user,
      mealTemplates,
      containers,
      foods,
      foodPortions,
      recipes,
      recipeIngredients,
      pantryItems,
      weightEntries,
      targets,
      dayLogs,
      meals,
      mealEntries,
      leftoverGroups,
      leftoverGroupEntries,
      advices,
    };
  },
};
