import type {
  CreateRecipeRequest,
  Rating,
  RecipeFull,
  RecipeIngredientInput,
  RecipePreviewRequest,
  RecipeUnit,
} from '@macronome/shared';
import { evalQuantity } from '../../../lib/format/parse';

// Editable form state for the recipe builder. Numeric fields are strings while editing;
// converted to the request body on save. Derived macros are NOT held here — they are read
// from the server (CLAUDE.md rule 2); the builder only collects inputs.

export interface NamedPortionLite {
  id: string;
  label: string;
  grams: number;
}

export interface IngredientDraft {
  refType: 'food' | 'recipe';
  refId: string;
  refName: string;
  namedPortions: NamedPortionLite[];
  quantity: string;
  unit: RecipeUnit;
  portionId: string | null;
}

export interface RecipeDraft {
  name: string;
  rating: Rating;
  servings: string;
  /** Manual batch weight; ignored while batchAuto (the server keeps batch = Σ). */
  batch: string;
  /** RW-1 "Poids auto": true ⇒ greyed field tracking the live ingredient sum. */
  batchAuto: boolean;
  instructions: string;
  ingredients: IngredientDraft[];
}

export function emptyRecipeDraft(): RecipeDraft {
  return {
    name: '',
    rating: null,
    servings: '1',
    batch: '',
    batchAuto: true,
    instructions: '',
    ingredients: [],
  };
}

export function initialRecipeDraft(recipe: RecipeFull | null): RecipeDraft {
  if (!recipe) return emptyRecipeDraft();
  return {
    name: recipe.name,
    rating: recipe.rating,
    servings: String(recipe.servings),
    batch: String(recipe.total_batch_grams),
    batchAuto: recipe.batch_weight_auto,
    instructions: recipe.instructions ?? '',
    ingredients: recipe.ingredients.map((i) => ({
      refType: i.ref_type,
      refId: i.ref_id,
      refName: i.ref_name,
      namedPortions: i.ref_named_portions.map((p) => ({
        id: p.id,
        label: p.label,
        grams: p.grams,
      })),
      quantity: String(i.quantity),
      unit: i.unit,
      portionId: i.portion_id,
    })),
  };
}

function ingredientInput(ing: IngredientDraft, index: number): RecipeIngredientInput {
  return {
    ref_type: ing.refType,
    ref_id: ing.refId,
    // Evaluate an arithmetic expression (B-108) so the preview/save use the result even if the
    // field was not blurred; invalid → 0 (the previous fallback).
    quantity: evalQuantity(String(ing.quantity)) ?? 0,
    unit: ing.unit,
    ...(ing.unit === 'portion' && ing.portionId ? { portion_id: ing.portionId } : {}),
    order_index: index,
  };
}

const servingsOf = (draft: RecipeDraft): number =>
  Math.max(1, Math.round(Number(draft.servings) || 1));

/** Manual batch weight to post: never sent while auto (the server resolves Σ). */
const batchField = (draft: RecipeDraft): { total_batch_grams?: number } => {
  const batch = draft.batch.trim();
  return !draft.batchAuto && batch ? { total_batch_grams: Number(batch) } : {};
};

/** Convert the draft to a create/update request body. */
export function draftToBody(draft: RecipeDraft): CreateRecipeRequest {
  return {
    name: draft.name.trim(),
    rating: draft.rating,
    servings: servingsOf(draft),
    instructions: draft.instructions.trim() || null,
    batch_weight_auto: draft.batchAuto,
    ...batchField(draft),
    ingredients: draft.ingredients.map(ingredientInput),
  };
}

/**
 * Build the stateless preview body (no name): only lines ready to compute — a positive
 * quantity, and a chosen portion when the unit is 'portion' — so half-typed lines don't
 * trigger a 422 while editing. An auto draft omits total_batch_grams (server returns Σ).
 */
export function draftToPreviewBody(draft: RecipeDraft): RecipePreviewRequest {
  return {
    servings: servingsOf(draft),
    ...batchField(draft),
    ingredients: draft.ingredients
      .map(ingredientInput)
      .filter((i) => i.quantity > 0 && (i.unit !== 'portion' || i.portion_id != null)),
  };
}
