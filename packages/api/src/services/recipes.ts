import type {
  CreateRecipeRequest,
  LoggableSearchQuery,
  RecipeFull,
  RecipeIngredientInput,
  RecipeListQuery,
  RecipeListResponse,
  RecipePreview,
  RecipePreviewRequest,
  RecipeSummary,
  UpdateRecipeRequest,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { recipeRepo, type RecipeWriteData } from '../data/repositories/recipe.repo.js';
import { recipeDerivedFoodRepo } from '../data/repositories/recipe-derived-food.repo.js';
import { loggableRepo } from '../data/repositories/loggable.repo.js';
import { wouldCreateCycle, type Adjacency } from '../domain/recipes/index.js';
import { normalize } from '../domain/search/normalize.js';
import { ApiError } from '../http/errors.js';
import {
  buildAndPersistDerived,
  buildFullDto,
  buildPreviewDto,
  resolveTotals,
  toWriteData,
  type NormIngredient,
} from './recipe-builder.js';

// Recipes service (spec/api/foods-recipes.md §Recipes): orchestration only. Validates the
// transitive cycle guard, defaults the batch weight, persists, (re)builds the derived food
// going forward, and cascades the rebuild to parent recipes. Pure maths live in
// domain/recipes; DTO shaping in recipe-builder.

const num = (d: { toString(): string }): number => Number(d.toString());

function normFromInput(ings: RecipeIngredientInput[]): NormIngredient[] {
  return ings.map((i) => ({
    refType: i.ref_type,
    refId: i.ref_id,
    quantity: i.quantity,
    unit: i.unit,
    portionId: i.portion_id ?? null,
    orderIndex: i.order_index,
  }));
}

/** Forward adjacency (recipe → recipes it references), optionally dropping one recipe's edges. */
async function adjacency(userId: string, excludeRecipeId?: string): Promise<Adjacency> {
  const edges = await recipeRepo.recipeEdges(userId);
  const adj: Adjacency = new Map();
  for (const e of edges) {
    if (e.recipeId === excludeRecipeId) continue;
    const set = adj.get(e.recipeId) ?? new Set<string>();
    set.add(e.refRecipeId);
    adj.set(e.recipeId, set);
  }
  return adj;
}

/** Reject if any recipe-type ingredient would close a cycle (A→B→…→E). */
async function assertNoCycle(
  userId: string,
  recipeId: string,
  ings: NormIngredient[],
): Promise<void> {
  const recipeRefs = ings.filter((i) => i.refType === 'recipe');
  if (recipeRefs.length === 0) return;
  const adj = await adjacency(userId, recipeId);
  for (const ref of recipeRefs) {
    if (wouldCreateCycle(recipeId, ref.refId, adj)) {
      throw new ApiError(422, ErrorCode.WouldCreateCycle, { ingredient: 'would_create_cycle' });
    }
  }
}

/** Recompute the derived food of every recipe that references `recipeId` (forward only). */
async function cascadeParents(userId: string, recipeId: string): Promise<void> {
  const edges = await recipeRepo.recipeEdges(userId);
  const parentsOf = new Map<string, Set<string>>();
  for (const e of edges) {
    const set = parentsOf.get(e.refRecipeId) ?? new Set<string>();
    set.add(e.recipeId);
    parentsOf.set(e.refRecipeId, set);
  }
  const queue = [...(parentsOf.get(recipeId) ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const parent = queue.shift() as string;
    if (seen.has(parent)) continue;
    seen.add(parent);
    await buildAndPersistDerived(userId, parent);
    for (const grand of parentsOf.get(parent) ?? []) queue.push(grand);
  }
}

async function resolveBatch(
  userId: string,
  ings: NormIngredient[],
  requested: number | undefined,
): Promise<number> {
  if (requested !== undefined) return requested;
  const { totalIngredientGrams } = await resolveTotals(userId, ings);
  return totalIngredientGrams;
}

function assertBatch(batch: number): void {
  if (!(batch > 0)) {
    throw new ApiError(422, ErrorCode.ValidationError, { total_batch_grams: 'must_be_positive' });
  }
}

function toSummary(
  recipe: {
    id: string;
    ownerId: string;
    name: string;
    totalBatchGrams: unknown;
    servings: number;
    rating: number | null;
    archivedAt: Date | null;
  },
  derived:
    | { foodId: string; per100g: { kcal: number; fat: number; carb: number; protein: number } }
    | undefined,
): RecipeSummary {
  const batch = num(recipe.totalBatchGrams as { toString(): string });
  const p = derived?.per100g ?? { kcal: 0, fat: 0, carb: 0, protein: 0 };
  return {
    id: recipe.id,
    owner_id: recipe.ownerId,
    name: recipe.name,
    kcal_per_100g: p.kcal,
    fat_per_100g: p.fat,
    carb_per_100g: p.carb,
    protein_per_100g: p.protein,
    total_batch_grams: batch,
    servings: recipe.servings,
    weight_per_portion_g: batch / recipe.servings,
    rating: (recipe.rating ?? null) as RecipeSummary['rating'],
    derived_food_id: derived?.foodId ?? null,
    archived_at: recipe.archivedAt ? recipe.archivedAt.toISOString() : null,
  };
}

export async function list(userId: string, query: RecipeListQuery): Promise<RecipeListResponse> {
  const opts = query.q ? { ...query, normalized: normalize(query.q) } : query;
  const { rows, nextCursor } = await recipeRepo.list(userId, opts);
  const derived = await recipeDerivedFoodRepo.derivedSummariesByRecipeIds(
    userId,
    rows.map((r) => r.id),
  );
  return { data: rows.map((r) => toSummary(r, derived.get(r.id))), next_cursor: nextCursor };
}

export async function get(userId: string, id: string): Promise<RecipeFull | null> {
  const recipe = await recipeRepo.findById(userId, id);
  return recipe ? buildFullDto(userId, recipe) : null;
}

/** Stateless live recompute for the builder (an unsaved draft); persists nothing. */
export async function preview(userId: string, body: RecipePreviewRequest): Promise<RecipePreview> {
  const ings = normFromInput(body.ingredients);
  const batch = await resolveBatch(userId, ings, body.total_batch_grams);
  return buildPreviewDto(userId, ings, body.servings, batch);
}

export async function create(
  userId: string,
  body: CreateRecipeRequest,
): Promise<{ recipe: RecipeFull; warnings: string[] }> {
  const ings = normFromInput(body.ingredients);
  const normalizedName = normalize(body.name);
  const warnings: string[] = [];
  if (await recipeRepo.existsActiveByNormalizedName(userId, normalizedName)) {
    warnings.push('duplicate_name');
  }
  const batch = await resolveBatch(userId, ings, body.total_batch_grams);
  assertBatch(batch);
  const data: RecipeWriteData = {
    name: body.name,
    normalizedName,
    instructions: body.instructions ?? null,
    rating: body.rating ?? null,
    totalBatchGrams: batch,
    servings: body.servings,
    ingredients: toWriteData(ings),
  };
  const id = await recipeRepo.create(userId, data);
  await buildAndPersistDerived(userId, id);
  const full = await get(userId, id);
  return { recipe: full as RecipeFull, warnings };
}

export async function update(
  userId: string,
  id: string,
  body: UpdateRecipeRequest,
): Promise<{ recipe: RecipeFull; warnings: string[] } | null> {
  const existing = await recipeRepo.findById(userId, id);
  if (!existing) return null;
  const useIngredients = body.ingredients !== undefined;
  const finalIngredients = useIngredients
    ? normFromInput(body.ingredients!)
    : existingToNorm(existing);
  await assertNoCycle(userId, id, finalIngredients);
  const name = body.name ?? existing.name;
  const normalizedName = normalize(name);
  const warnings: string[] = [];
  if (await recipeRepo.existsActiveByNormalizedName(userId, normalizedName, id)) {
    warnings.push('duplicate_name');
  }
  const requestedBatch =
    body.total_batch_grams ?? (useIngredients ? undefined : num(existing.totalBatchGrams));
  const batch = await resolveBatch(userId, finalIngredients, requestedBatch);
  assertBatch(batch);
  const data: RecipeWriteData = {
    name,
    normalizedName,
    instructions:
      body.instructions !== undefined ? (body.instructions ?? null) : existing.instructions,
    rating: body.rating !== undefined ? body.rating : existing.rating,
    totalBatchGrams: batch,
    servings: body.servings ?? existing.servings,
    ingredients: toWriteData(finalIngredients),
  };
  const ok = await recipeRepo.update(userId, id, data);
  if (!ok) return null;
  await buildAndPersistDerived(userId, id);
  await cascadeParents(userId, id);
  const full = await get(userId, id);
  return { recipe: full as RecipeFull, warnings };
}

export async function archive(userId: string, id: string): Promise<boolean> {
  const ok = await recipeRepo.setArchived(userId, id, true);
  if (ok) await recipeDerivedFoodRepo.setArchivedByRecipe(userId, id, true);
  return ok;
}

export async function restore(userId: string, id: string): Promise<boolean> {
  const ok = await recipeRepo.setArchived(userId, id, false);
  if (ok) await recipeDerivedFoodRepo.setArchivedByRecipe(userId, id, false);
  return ok;
}

export async function loggableSearch(userId: string, query: LoggableSearchQuery) {
  const normalized = query.q ? normalize(query.q) : undefined;
  return { data: await loggableRepo.search(userId, normalized, query.limit) };
}

// Local helper: normalise an existing recipe's persisted ingredients (for PATCHes that
// omit `ingredients` — keep the current set).
function existingToNorm(recipe: Awaited<ReturnType<typeof recipeRepo.findById>>): NormIngredient[] {
  if (!recipe) return [];
  return recipe.ingredients.map((i) => ({
    refType: i.refType as 'food' | 'recipe',
    refId: (i.refType === 'food' ? i.refFoodId : i.refRecipeId) as string,
    quantity: num(i.quantity),
    unit: i.unit as NormIngredient['unit'],
    portionId: i.portionId,
    orderIndex: i.orderIndex,
  }));
}
