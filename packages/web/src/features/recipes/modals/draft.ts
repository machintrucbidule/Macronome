import type { CreateRecipeRequest, RecipeFull, RecipeUnit } from '@macronome/shared';

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
  servings: string;
  /** '' = let the server default to Σ ingredient grams. */
  batch: string;
  instructions: string;
  ingredients: IngredientDraft[];
}

export function emptyRecipeDraft(): RecipeDraft {
  return { name: '', servings: '1', batch: '', instructions: '', ingredients: [] };
}

export function initialRecipeDraft(recipe: RecipeFull | null): RecipeDraft {
  if (!recipe) return emptyRecipeDraft();
  return {
    name: recipe.name,
    servings: String(recipe.servings),
    batch: String(recipe.total_batch_grams),
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

/** Convert the draft to a create/update request body. */
export function draftToBody(draft: RecipeDraft): CreateRecipeRequest {
  const batch = draft.batch.trim();
  return {
    name: draft.name.trim(),
    servings: Math.max(1, Math.round(Number(draft.servings) || 1)),
    instructions: draft.instructions.trim() || null,
    ...(batch ? { total_batch_grams: Number(batch) } : {}),
    ingredients: draft.ingredients.map((ing, index) => ({
      ref_type: ing.refType,
      ref_id: ing.refId,
      quantity: Number(ing.quantity) || 0,
      unit: ing.unit,
      ...(ing.unit === 'portion' && ing.portionId ? { portion_id: ing.portionId } : {}),
      order_index: index,
    })),
  };
}
