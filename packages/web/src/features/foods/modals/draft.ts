import type { CreateFoodRequest, Food, Rating } from '@macronome/shared';
import type { PortionDraft } from './NamedPortionsEditor';

// Editable form state for the food add/edit modal. Numeric fields are strings while
// editing; converted to the request body on save.
export interface Draft {
  name: string;
  kcal: string;
  fat: string;
  carb: string;
  protein: string;
  comment: string;
  rating: Rating;
  visibility: 'private' | 'shared';
  aiProposable: boolean;
  portions: PortionDraft[];
}

export function initialDraft(food: Food | null): Draft {
  if (!food) {
    return {
      name: '',
      kcal: '',
      fat: '',
      carb: '',
      protein: '',
      comment: '',
      rating: null,
      visibility: 'private',
      aiProposable: true,
      portions: [],
    };
  }
  return {
    name: food.name,
    kcal: String(food.kcal_per_100g),
    fat: String(food.fat_per_100g),
    carb: String(food.carb_per_100g),
    protein: String(food.protein_per_100g),
    comment: food.comment ?? '',
    rating: food.rating,
    visibility: food.visibility,
    aiProposable: food.ai_proposable,
    portions: food.named_portions.map((p) => ({ label: p.label, grams: String(p.grams) })),
  };
}

/** Convert the draft to a create/update request body (portions cleaned). */
export function draftToBody(draft: Draft): CreateFoodRequest {
  return {
    name: draft.name.trim(),
    kcal_per_100g: Number(draft.kcal) || 0,
    fat_per_100g: Number(draft.fat) || 0,
    carb_per_100g: Number(draft.carb) || 0,
    protein_per_100g: Number(draft.protein) || 0,
    comment: draft.comment.trim() || null,
    rating: draft.rating,
    visibility: draft.visibility,
    ai_proposable: draft.aiProposable,
    named_portions: draft.portions
      .map((p) => ({ label: p.label.trim(), grams: Number(p.grams) }))
      .filter((p) => p.label && p.grams > 0),
  };
}
