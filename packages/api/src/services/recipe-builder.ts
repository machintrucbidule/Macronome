import type {
  RecipeFull,
  RecipeIngredient,
  RecipePreview,
  RecipePreviewIngredient,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import {
  recipeRepo,
  type IngredientWriteData,
  type RecipeWithIngredients,
} from '../data/repositories/recipe.repo.js';
import {
  recipeDerivedFoodRepo,
  type ResolvedFood,
} from '../data/repositories/recipe-derived-food.repo.js';
import {
  aggregateMacros,
  buildDerivedFood,
  per100,
  perPortion,
  weightPerPortion,
  type AggregateResult,
  type IngredientInput,
} from '../domain/recipes/index.js';
import type { ServingUnit } from '../domain/serving/serving.js';
import { ApiError } from '../http/errors.js';

// Recipe resolution + derivation orchestration (spec/logic/recipes-derived-food.md).
// Resolves each ingredient (a food, or a nested recipe's derived food) to per-100 g
// macros, aggregates, and (re)builds the derived food. Pure maths live in domain/recipes;
// this only wires the repos to them.

const num = (d: { toString(): string }): number => Number(d.toString());

export interface NormIngredient {
  refType: 'food' | 'recipe';
  refId: string;
  quantity: number;
  unit: ServingUnit;
  portionId: string | null;
  orderIndex: number;
}

export function normFromModels(recipe: RecipeWithIngredients): NormIngredient[] {
  return recipe.ingredients.map((i) => ({
    refType: i.refType as 'food' | 'recipe',
    refId: (i.refType === 'food' ? i.refFoodId : i.refRecipeId) as string,
    quantity: num(i.quantity),
    unit: i.unit as ServingUnit,
    portionId: i.portionId,
    orderIndex: i.orderIndex,
  }));
}

export function toWriteData(ings: NormIngredient[]): IngredientWriteData[] {
  return ings.map((i) => ({
    refType: i.refType,
    refFoodId: i.refType === 'food' ? i.refId : null,
    refRecipeId: i.refType === 'recipe' ? i.refId : null,
    quantity: i.quantity,
    unit: i.unit,
    portionId: i.portionId,
    orderIndex: i.orderIndex,
  }));
}

/** Resolve each ingredient to its referenced food (real food, or nested recipe's derived). */
async function resolve(userId: string, ings: NormIngredient[]): Promise<ResolvedFood[]> {
  const recipeRefIds = ings.filter((i) => i.refType === 'recipe').map((i) => i.refId);
  const derivedIdByRecipe = await recipeDerivedFoodRepo.derivedFoodIdByRecipeIds(
    userId,
    recipeRefIds,
  );
  const foodIds: string[] = ings.map((i) =>
    i.refType === 'food' ? i.refId : (derivedIdByRecipe.get(i.refId) ?? ''),
  );
  const foods = await recipeDerivedFoodRepo.foodsByIds(userId, foodIds.filter(Boolean));
  return ings.map((i, idx) => {
    const food = foods.get(foodIds[idx] ?? '');
    if (!food) throw new ApiError(422, ErrorCode.ValidationError, { ingredient: 'ref_not_found' });
    return food;
  });
}

function portionGramsFor(ing: NormIngredient, food: ResolvedFood): number | null {
  if (ing.unit !== 'portion') return null;
  const portion = food.portions.find((p) => p.id === ing.portionId);
  if (!portion)
    throw new ApiError(422, ErrorCode.ValidationError, { portion_id: 'portion_not_found' });
  return portion.grams;
}

function toInputs(ings: NormIngredient[], foods: ResolvedFood[]): IngredientInput[] {
  return ings.map((ing, idx) => ({
    per100g: foods[idx]!.per100g,
    quantity: ing.quantity,
    unit: ing.unit,
    portionGrams: portionGramsFor(ing, foods[idx]!),
  }));
}

export interface ResolvedTotals {
  totalIngredientGrams: number;
  totalMacros: IngredientInput['per100g'];
  foods: ResolvedFood[];
  inputs: IngredientInput[];
}

/** Resolve + aggregate a set of normalised ingredients. */
export async function resolveTotals(
  userId: string,
  ings: NormIngredient[],
): Promise<ResolvedTotals> {
  const foods = await resolve(userId, ings);
  const inputs = toInputs(ings, foods);
  const { totalIngredientGrams, totalMacros } = aggregateMacros(inputs);
  return { totalIngredientGrams, totalMacros, foods, inputs };
}

/** (Re)build and persist a recipe's derived food from its current ingredients.
 *  RW-1: an auto recipe's batch weight is refreshed to the current Σ first, so a
 *  nested-recipe edit cascading here re-tracks the parent's weight too. */
export async function buildAndPersistDerived(userId: string, recipeId: string): Promise<void> {
  const recipe = await recipeRepo.findById(userId, recipeId);
  if (!recipe) return;
  const { totalIngredientGrams, totalMacros } = await resolveTotals(userId, normFromModels(recipe));
  let batch = num(recipe.totalBatchGrams);
  if (recipe.batchWeightAuto && totalIngredientGrams > 0 && totalIngredientGrams !== batch) {
    batch = totalIngredientGrams;
    await recipeRepo.setBatchGrams(userId, recipeId, batch);
  }
  const derived = buildDerivedFood(totalMacros, batch, recipe.servings);
  await recipeDerivedFoodRepo.upsert(
    userId,
    recipeId,
    recipe.name,
    recipe.normalizedName,
    derived.per100g,
    derived.portionGrams,
  );
}

const ZERO_MACROS = { kcal: 0, fat: 0, carb: 0, protein: 0 };

/** Resolved ingredient lines (grams + macro snapshot), shared by the full + preview DTOs. */
function toPreviewLines(
  ings: NormIngredient[],
  foods: ResolvedFood[],
  aggregated: AggregateResult,
): RecipePreviewIngredient[] {
  return ings.map((ing, idx) => {
    const line = aggregated.lines[idx]!;
    return {
      ref_type: ing.refType,
      ref_id: ing.refId,
      ref_name: foods[idx]!.name,
      quantity: ing.quantity,
      unit: ing.unit,
      portion_id: ing.portionId,
      order_index: ing.orderIndex,
      grams: line.grams,
      kcal: line.macros.kcal,
      fat: line.macros.fat,
      carb: line.macros.carb,
      protein: line.macros.protein,
      ref_named_portions: foods[idx]!.portions.map((p) => ({
        id: p.id,
        label: p.label,
        grams: p.grams,
      })),
    };
  });
}

/** Stateless derived figures for an unsaved draft (spec/api/foods-recipes.md §preview). */
export async function buildPreviewDto(
  userId: string,
  ings: NormIngredient[],
  servings: number,
  batch: number,
): Promise<RecipePreview> {
  const { totalIngredientGrams, totalMacros, foods, inputs } = await resolveTotals(userId, ings);
  const aggregated = aggregateMacros(inputs);
  // batch is 0 only when there are no ingredients (default = Σ grams) → keep per-100 g zeroed.
  const p100 = batch > 0 ? per100(totalMacros, batch) : ZERO_MACROS;
  const pp = perPortion(totalMacros, servings);
  return {
    total_ingredient_grams: totalIngredientGrams,
    total_batch_grams: batch,
    servings,
    kcal_per_100g: p100.kcal,
    fat_per_100g: p100.fat,
    carb_per_100g: p100.carb,
    protein_per_100g: p100.protein,
    weight_per_portion_g: weightPerPortion(batch, servings),
    total_macros: { ...totalMacros },
    per_portion: { kcal: pp.kcal, fat: pp.fat, carb: pp.carb, protein: pp.protein },
    ingredients: toPreviewLines(ings, foods, aggregated),
  };
}

/** Build the full builder-view DTO for a persisted recipe. */
export async function buildFullDto(
  userId: string,
  recipe: RecipeWithIngredients,
): Promise<RecipeFull> {
  const ings = normFromModels(recipe);
  const { totalIngredientGrams, totalMacros, foods, inputs } = await resolveTotals(userId, ings);
  const batch = num(recipe.totalBatchGrams);
  const p100 = per100(totalMacros, batch);
  const pp = perPortion(totalMacros, recipe.servings);
  const aggregated = aggregateMacros(inputs);
  const derivedId = (await recipeDerivedFoodRepo.derivedFoodIdByRecipeIds(userId, [recipe.id])).get(
    recipe.id,
  );
  const ingredients: RecipeIngredient[] = toPreviewLines(ings, foods, aggregated).map(
    (line, idx) => ({ id: recipe.ingredients[idx]!.id, ...line }),
  );
  return {
    id: recipe.id,
    owner_id: recipe.ownerId,
    name: recipe.name,
    kcal_per_100g: p100.kcal,
    fat_per_100g: p100.fat,
    carb_per_100g: p100.carb,
    protein_per_100g: p100.protein,
    total_batch_grams: batch,
    batch_weight_auto: recipe.batchWeightAuto,
    servings: recipe.servings,
    weight_per_portion_g: weightPerPortion(batch, recipe.servings),
    rating: (recipe.rating ?? null) as RecipeFull['rating'],
    derived_food_id: derivedId ?? null,
    archived_at: recipe.archivedAt ? recipe.archivedAt.toISOString() : null,
    instructions: recipe.instructions,
    total_ingredient_grams: totalIngredientGrams,
    per_portion: { kcal: pp.kcal, fat: pp.fat, carb: pp.carb, protein: pp.protein },
    ingredients,
  };
}
