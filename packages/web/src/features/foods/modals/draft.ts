import type {
  ChronoFoodPrefill,
  CreateFoodRequest,
  Food,
  FoodParseLabel,
  Rating,
} from '@macronome/shared';
import type { PortionDraft } from './NamedPortionsEditor';

/** What the client may declare as provenance (B-290); `recipe` is server-owned. */
type DraftSource = CreateFoodRequest['source'];

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
  /** How the draft was built. Sent on create only — `PATCH /foods/:id` ignores it (B-290). */
  source: DraftSource;
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
      source: 'manual',
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
    // Carried for completeness only: the edit path never sends it. A recipe-derived food
    // cannot reach this modal (the browse list excludes source='recipe').
    source: food.source === 'recipe' ? 'manual' : food.source,
    aiProposable: food.ai_proposable,
    portions: food.named_portions.map((p) => ({ label: p.label, grams: String(p.grams) })),
  };
}

/** Parsed-label patch (PM-1/B-114): only the macros found; a missing one is untouched. */
export function parsedPatch(macros: FoodParseLabel): Partial<Draft> {
  const patch: Partial<Draft> = {};
  if (macros.kcal_per_100g !== undefined) patch.kcal = String(macros.kcal_per_100g);
  if (macros.fat_per_100g !== undefined) patch.fat = String(macros.fat_per_100g);
  if (macros.carb_per_100g !== undefined) patch.carb = String(macros.carb_per_100g);
  if (macros.protein_per_100g !== undefined) patch.protein = String(macros.protein_per_100g);
  return patch;
}

/**
 * Chronodrive patch (B-182): name + macros + comment from the server-side prefill. A
 * null macro (undeclared by the manufacturer) EMPTIES its field — the "à compléter"
 * notice covers it. An empty prefill name keeps the current one.
 *
 * It also stamps the provenance (B-290): a food built from a Chronodrive product is saved as
 * `chronodrive` and stays so even if the values are edited afterwards. The macro-label parser
 * (`parsedPatch`) deliberately does NOT stamp anything — pasting a label is typing, faster.
 */
export function chronoPatch(prefill: ChronoFoodPrefill, currentName: string): Partial<Draft> {
  return {
    source: 'chronodrive',
    name: prefill.name || currentName,
    kcal: prefill.kcal_per_100g != null ? String(prefill.kcal_per_100g) : '',
    fat: prefill.fat_per_100g != null ? String(prefill.fat_per_100g) : '',
    carb: prefill.carb_per_100g != null ? String(prefill.carb_per_100g) : '',
    protein: prefill.protein_per_100g != null ? String(prefill.protein_per_100g) : '',
    comment: prefill.comment ?? '',
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
    source: draft.source,
    ai_proposable: draft.aiProposable,
    named_portions: draft.portions
      .map((p) => ({ label: p.label.trim(), grams: Number(p.grams) }))
      .filter((p) => p.label && p.grams > 0),
  };
}
