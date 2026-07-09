import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Delete side of the data wipe (IMP-1, B-001) — also reused by the import replace step.
// Removes every user-scoped row in child→parent order so the RESTRICT foreign keys
// (food←meal_entry/pantry/recipe_ingredient, recipe←recipe_ingredient) never block a bulk
// delete; ON DELETE CASCADE handles the day_log/meal/recipe subtrees. User-scoped (rule 3).
//
// `keepStructure` preserves the seed the account needs to stay usable: the meal_slot_template
// rows (day structure) and the built-in "Rien" container. B-001 keeps them; import clears them
// (the imported extract restores its own). The owner `app_user` row is never touched here.

export interface WipeOptions {
  /** Keep meal_slot_template rows and the built-in container (B-001). */
  keepStructure: boolean;
}

/** Delete all user-scoped rows inside an existing transaction. */
export async function deleteAllUserData(
  tx: Prisma.TransactionClient,
  userId: string,
  opts: WipeOptions,
): Promise<void> {
  const recipes = await tx.recipe.findMany({ where: { ownerId: userId }, select: { id: true } });
  const recipeIds = recipes.map((r) => r.id);

  await tx.dayLog.deleteMany({ where: { userId } }); // cascades meal → meal_entry → leftover_*
  await tx.pantryItem.deleteMany({ where: { userId } });
  await tx.recipeIngredient.deleteMany({ where: { recipeId: { in: recipeIds } } });
  await tx.food.deleteMany({ where: { ownerId: userId } }); // cascades food_portion
  await tx.recipe.deleteMany({ where: { ownerId: userId } });
  await tx.weightEntry.deleteMany({ where: { userId } });
  await tx.target.deleteMany({ where: { userId } });
  await tx.advice.deleteMany({ where: { userId } }); // B-202: archived Conseils are content
  await tx.container.deleteMany({
    where: { ownerId: userId, ...(opts.keepStructure ? { isBuiltin: false } : {}) },
  });
  if (!opts.keepStructure) await tx.mealSlotTemplate.deleteMany({ where: { userId } });
}

export const dataWipeRepo = {
  /** B-001: wipe all tracked data, keep the account's seed (structure + built-in container). */
  async wipeContent(userId: string): Promise<void> {
    await prisma.$transaction((tx) => deleteAllUserData(tx, userId, { keepStructure: true }));
  },
};
