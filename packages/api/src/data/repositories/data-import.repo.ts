import type { Prisma } from '@prisma/client';
import type { DataExportEnvelope } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { deleteAllUserData } from './data-wipe.repo.js';

// Write side of the data import (IMP-1, B-003) — REPLACE / restore semantics. In one
// transaction it wipes every user-scoped row (structure included), restores profile + settings
// onto the owner row (never credentials), then re-inserts the extract verbatim. Original ids are
// kept (the account was just wiped, so no collision) and only owner/user columns are re-pointed
// at the current user, so the same file restores into a fresh install too. Frozen snapshots
// (snap_*, target_snapshot, leftover container values) are carried across unchanged.
//
// Insert order is parent→child to satisfy the RESTRICT FKs: recipe → food (derived food.recipe_id)
// → food_portion → recipe_ingredient, then the logging subtree day_log → meal → meal_entry →
// leftover_group → leftover_group_entry.

type Tx = Prisma.TransactionClient;

const d = (v: string): Date => new Date(v);
const dn = (v: string | null): Date | null => (v === null ? null : new Date(v));

async function restoreProfile(tx: Tx, userId: string, env: DataExportEnvelope): Promise<void> {
  await tx.appUser.update({
    where: { id: userId },
    data: {
      sex: env.profile.sex,
      birthdate: d(env.profile.birthdate),
      heightCm: env.profile.height_cm,
      settings: (env.settings ?? {}) as Prisma.InputJsonValue,
    },
  });
}

async function insertCatalog(tx: Tx, userId: string, env: DataExportEnvelope): Promise<void> {
  if (env.recipes.length) {
    await tx.recipe.createMany({
      data: env.recipes.map((r) => ({
        id: r.id,
        ownerId: userId,
        name: r.name,
        normalizedName: r.normalized_name,
        instructions: r.instructions,
        totalBatchGrams: r.total_batch_grams,
        servings: r.servings,
        rating: r.rating,
        archivedAt: dn(r.archived_at),
        createdAt: d(r.created_at),
      })),
    });
  }
  if (env.foods.length) {
    await tx.food.createMany({
      data: env.foods.map((f) => ({
        id: f.id,
        ownerId: userId,
        name: f.name,
        normalizedName: f.normalized_name,
        kcalPer100g: f.kcal_per_100g,
        fatPer100g: f.fat_per_100g,
        carbPer100g: f.carb_per_100g,
        proteinPer100g: f.protein_per_100g,
        comment: f.comment,
        rating: f.rating,
        visibility: f.visibility,
        source: f.source,
        recipeId: f.recipe_id,
        archivedAt: dn(f.archived_at),
        createdAt: d(f.created_at),
      })),
    });
  }
  if (env.food_portions.length) {
    await tx.foodPortion.createMany({
      data: env.food_portions.map((p) => ({
        id: p.id,
        foodId: p.food_id,
        label: p.label,
        grams: p.grams,
        createdAt: d(p.created_at),
      })),
    });
  }
  if (env.recipe_ingredients.length) {
    await tx.recipeIngredient.createMany({
      data: env.recipe_ingredients.map((i) => ({
        id: i.id,
        recipeId: i.recipe_id,
        refType: i.ref_type,
        refFoodId: i.ref_food_id,
        refRecipeId: i.ref_recipe_id,
        quantity: i.quantity,
        unit: i.unit,
        portionId: i.portion_id,
        orderIndex: i.order_index,
      })),
    });
  }
}

async function insertStructure(tx: Tx, userId: string, env: DataExportEnvelope): Promise<void> {
  if (env.containers.length) {
    await tx.container.createMany({
      data: env.containers.map((c) => ({
        id: c.id,
        ownerId: userId,
        name: c.name,
        normalizedName: c.normalized_name,
        emptyWeightG: c.empty_weight_g,
        isBuiltin: c.is_builtin,
        createdAt: d(c.created_at),
      })),
    });
  }
  if (env.meal_templates.length) {
    await tx.mealSlotTemplate.createMany({
      data: env.meal_templates.map((m) => ({
        id: m.id,
        userId,
        name: m.name,
        orderIndex: m.order_index,
        createdAt: d(m.created_at),
      })),
    });
  }
  if (env.pantry_items.length) {
    await tx.pantryItem.createMany({
      data: env.pantry_items.map((p) => ({
        id: p.id,
        userId,
        mealSlotName: p.meal_slot_name,
        foodId: p.food_id,
        orderIndex: p.order_index,
        createdAt: d(p.created_at),
      })),
    });
  }
}

async function insertWeightTargets(tx: Tx, userId: string, env: DataExportEnvelope): Promise<void> {
  if (env.weight_entries.length) {
    await tx.weightEntry.createMany({
      data: env.weight_entries.map((w) => ({
        id: w.id,
        userId,
        date: d(w.date),
        weightKg: w.weight_kg,
        waistCm: w.waist_cm,
        dietFlag: w.diet_flag,
        note: w.note,
        createdAt: d(w.created_at),
      })),
    });
  }
  if (env.targets.length) {
    await tx.target.createMany({
      data: env.targets.map((t) => ({
        id: t.id,
        userId,
        calorieMin: t.calorie_min,
        calorieMax: t.calorie_max,
        proteinGPerKg: t.protein_g_per_kg,
        fatGPerKg: t.fat_g_per_kg,
        targetWeightKg: t.target_weight_kg,
        rateKgPerWeek: t.rate_kg_per_week,
        effectiveFrom: d(t.effective_from),
        createdAt: d(t.created_at),
      })),
    });
  }
}

async function insertLogging(tx: Tx, userId: string, env: DataExportEnvelope): Promise<void> {
  if (env.day_logs.length) {
    await tx.dayLog.createMany({
      data: env.day_logs.map((dl) => ({
        id: dl.id,
        userId,
        date: d(dl.date),
        kind: dl.kind,
        summaryKcal: dl.summary_kcal,
        activityLevel: dl.activity_level,
        comment: dl.comment,
        verdictAuto: dl.verdict_auto,
        verdictOverride: dl.verdict_override,
        targetSnapshot: (dl.target_snapshot ?? {}) as Prisma.InputJsonValue,
        createdAt: d(dl.created_at),
      })),
    });
  }
  if (env.meals.length) {
    await tx.meal.createMany({
      data: env.meals.map((m) => ({
        id: m.id,
        dayLogId: m.day_log_id,
        slotName: m.slot_name,
        orderIndex: m.order_index,
        createdAt: d(m.created_at),
      })),
    });
  }
  if (env.meal_entries.length) {
    await tx.mealEntry.createMany({
      data: env.meal_entries.map((e) => ({
        id: e.id,
        mealId: e.meal_id,
        kind: e.kind,
        foodId: e.food_id,
        customName: e.custom_name,
        servedQuantity: e.served_quantity,
        unit: e.unit,
        portionId: e.portion_id,
        servedGrams: e.served_grams,
        snapKcal: e.snap_kcal,
        snapFat: e.snap_fat,
        snapCarb: e.snap_carb,
        snapProtein: e.snap_protein,
        orderIndex: e.order_index,
        createdAt: d(e.created_at),
      })),
    });
  }
  if (env.leftover_groups.length) {
    await tx.leftoverGroup.createMany({
      data: env.leftover_groups.map((g) => ({
        id: g.id,
        mealId: g.meal_id,
        containerName: g.container_name,
        tareG: g.tare_g,
        grossGrams: g.gross_grams,
        createdAt: d(g.created_at),
      })),
    });
  }
  if (env.leftover_group_entries.length) {
    await tx.leftoverGroupEntry.createMany({
      data: env.leftover_group_entries.map((l) => ({
        leftoverGroupId: l.leftover_group_id,
        mealEntryId: l.meal_entry_id,
      })),
    });
  }
}

export const dataImportRepo = {
  async replaceAll(userId: string, env: DataExportEnvelope): Promise<void> {
    await prisma.$transaction(
      async (tx) => {
        await deleteAllUserData(tx, userId, { keepStructure: false });
        await restoreProfile(tx, userId, env);
        await insertCatalog(tx, userId, env);
        await insertStructure(tx, userId, env);
        await insertWeightTargets(tx, userId, env);
        await insertLogging(tx, userId, env);
      },
      { timeout: 30_000 },
    );
  },
};
