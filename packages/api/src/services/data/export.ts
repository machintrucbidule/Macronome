import type { Prisma } from '@prisma/client';
import { DATA_EXPORT_FORMAT_VERSION, type DataExportEnvelope } from '@macronome/shared';
import { dataExportRepo, type ExportRows } from '../../data/repositories/data-export.repo.js';

// Build the portable export envelope (IMP-1, B-002) from the user's rows. Pure serialisation:
// Decimal → number, DATE columns → `YYYY-MM-DD`, instants → ISO-8601, JSON blobs verbatim.
// Credentials are never read or emitted. Returns null when the user does not exist (404).

const num = (v: Prisma.Decimal): number => Number(v.toString());
const numN = (v: Prisma.Decimal | null): number | null => (v === null ? null : num(v));
const day = (v: Date): string => v.toISOString().slice(0, 10);
const iso = (v: Date): string => v.toISOString();
const isoN = (v: Date | null): string | null => (v === null ? null : v.toISOString());

type Env = DataExportEnvelope;

function mapStructure(
  rows: ExportRows,
): Pick<Env, 'profile' | 'settings' | 'meal_templates' | 'containers'> {
  return {
    profile: {
      sex: rows.user.sex,
      birthdate: day(rows.user.birthdate),
      height_cm: num(rows.user.heightCm),
    },
    settings: rows.user.settings,
    meal_templates: rows.mealTemplates.map((m) => ({
      id: m.id,
      name: m.name,
      order_index: m.orderIndex,
      created_at: iso(m.createdAt),
    })),
    containers: rows.containers.map((c) => ({
      id: c.id,
      name: c.name,
      normalized_name: c.normalizedName,
      empty_weight_g: num(c.emptyWeightG),
      is_builtin: c.isBuiltin,
      created_at: iso(c.createdAt),
    })),
  };
}

function mapCatalog(
  rows: ExportRows,
): Pick<Env, 'foods' | 'food_portions' | 'recipes' | 'recipe_ingredients' | 'pantry_items'> {
  return {
    foods: rows.foods.map((f) => ({
      id: f.id,
      name: f.name,
      normalized_name: f.normalizedName,
      kcal_per_100g: num(f.kcalPer100g),
      fat_per_100g: num(f.fatPer100g),
      carb_per_100g: num(f.carbPer100g),
      protein_per_100g: num(f.proteinPer100g),
      comment: f.comment,
      rating: f.rating,
      visibility: f.visibility,
      source: f.source,
      recipe_id: f.recipeId,
      archived_at: isoN(f.archivedAt),
      created_at: iso(f.createdAt),
    })),
    food_portions: rows.foodPortions.map((p) => ({
      id: p.id,
      food_id: p.foodId,
      label: p.label,
      grams: num(p.grams),
      created_at: iso(p.createdAt),
    })),
    recipes: rows.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      normalized_name: r.normalizedName,
      instructions: r.instructions,
      total_batch_grams: num(r.totalBatchGrams),
      servings: r.servings,
      rating: r.rating,
      archived_at: isoN(r.archivedAt),
      created_at: iso(r.createdAt),
    })),
    recipe_ingredients: rows.recipeIngredients.map((i) => ({
      id: i.id,
      recipe_id: i.recipeId,
      ref_type: i.refType,
      ref_food_id: i.refFoodId,
      ref_recipe_id: i.refRecipeId,
      quantity: num(i.quantity),
      unit: i.unit,
      portion_id: i.portionId,
      order_index: i.orderIndex,
    })),
    pantry_items: rows.pantryItems.map((p) => ({
      id: p.id,
      meal_slot_name: p.mealSlotName,
      food_id: p.foodId,
      order_index: p.orderIndex,
      created_at: iso(p.createdAt),
    })),
  };
}

function mapWeightTargets(rows: ExportRows): Pick<Env, 'weight_entries' | 'targets'> {
  return {
    weight_entries: rows.weightEntries.map((w) => ({
      id: w.id,
      date: day(w.date),
      weight_kg: num(w.weightKg),
      waist_cm: numN(w.waistCm),
      diet_flag: w.dietFlag,
      note: w.note,
      created_at: iso(w.createdAt),
    })),
    targets: rows.targets.map((t) => ({
      id: t.id,
      calorie_min: t.calorieMin,
      calorie_max: t.calorieMax,
      protein_g_per_kg: num(t.proteinGPerKg),
      fat_g_per_kg: num(t.fatGPerKg),
      target_weight_kg: numN(t.targetWeightKg),
      rate_kg_per_week: numN(t.rateKgPerWeek),
      effective_from: day(t.effectiveFrom),
      created_at: iso(t.createdAt),
    })),
  };
}

function mapLogging(
  rows: ExportRows,
): Pick<Env, 'day_logs' | 'meals' | 'meal_entries' | 'leftover_groups' | 'leftover_group_entries'> {
  return {
    day_logs: rows.dayLogs.map((dl) => ({
      id: dl.id,
      date: day(dl.date),
      kind: dl.kind,
      summary_kcal: numN(dl.summaryKcal),
      activity_level: dl.activityLevel,
      comment: dl.comment,
      verdict_auto: dl.verdictAuto,
      verdict_override: dl.verdictOverride,
      target_snapshot: dl.targetSnapshot,
      created_at: iso(dl.createdAt),
    })),
    meals: rows.meals.map((m) => ({
      id: m.id,
      day_log_id: m.dayLogId,
      slot_name: m.slotName,
      order_index: m.orderIndex,
      created_at: iso(m.createdAt),
    })),
    meal_entries: rows.mealEntries.map((e) => ({
      id: e.id,
      meal_id: e.mealId,
      kind: e.kind,
      food_id: e.foodId,
      custom_name: e.customName,
      served_quantity: num(e.servedQuantity),
      unit: e.unit,
      portion_id: e.portionId,
      served_grams: numN(e.servedGrams),
      snap_kcal: num(e.snapKcal),
      snap_fat: num(e.snapFat),
      snap_carb: num(e.snapCarb),
      snap_protein: num(e.snapProtein),
      order_index: e.orderIndex,
      created_at: iso(e.createdAt),
    })),
    leftover_groups: rows.leftoverGroups.map((g) => ({
      id: g.id,
      meal_id: g.mealId,
      container_name: g.containerName,
      tare_g: num(g.tareG),
      gross_grams: num(g.grossGrams),
      created_at: iso(g.createdAt),
    })),
    leftover_group_entries: rows.leftoverGroupEntries.map((l) => ({
      leftover_group_id: l.leftoverGroupId,
      meal_entry_id: l.mealEntryId,
    })),
  };
}

function toEnvelope(rows: ExportRows): DataExportEnvelope {
  return {
    format_version: DATA_EXPORT_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    ...mapStructure(rows),
    ...mapCatalog(rows),
    ...mapWeightTargets(rows),
    ...mapLogging(rows),
  };
}

/** Assemble the full export envelope for the user, or null when the user is absent. */
export async function buildExport(userId: string): Promise<DataExportEnvelope | null> {
  const rows = await dataExportRepo.readAll(userId);
  return rows ? toEnvelope(rows) : null;
}
