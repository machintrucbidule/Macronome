// AI meal-suggestions "chef" domain types (spec/logic/ai-meal-suggestions.md §1–§6, B-123). Pure
// I/O shapes for prompt assembly + reply parsing; no I/O, no user scope. The chef picks foods
// qualitatively and outputs no quantities — the deterministic solver (`meal-solver/`) sets those.
import type { MealSuggestionsRequest, Rating } from '@macronome/shared';
import type { Macros, Remaining } from '../meal-solver/types.js';

/** One named portion of a candidate food (label + grams), as offered to the chef. */
export interface ChefPortion {
  portion_id: string;
  label: string;
  grams: number;
}

/** One candidate-pool entry (§3): the food's per-100 g macros, rating, and named portions. The
 *  chef may pick it and assign it to a meal; if it has portions it must choose exactly one. */
export interface ChefFood {
  food_id: string;
  name: string;
  per100g: Macros;
  rating: Rating;
  portions: ChefPortion[];
}

/** A meal the user selected to fill (`meal_ids`), surfaced to the chef by id + name. */
export interface ChefMeal {
  meal_id: string;
  name: string;
}

/** One OK-day history entry (§4): names + quantities only — never identity/weight/BMI (Privacy §5). */
export interface HistoryDay {
  date_offset: number;
  meal_name: string;
  foods: { name: string; qty: string }[];
}

/** Everything `buildMealSuggestionsMessages` serialises into the context block (§2.2). Carries
 *  no identity/weight/BMI by construction (Privacy §5). `remaining` reuses the solver's shape. */
export interface ChefContext {
  remaining: Remaining;
  meals: ChefMeal[];
  candidates: ChefFood[];
  history: HistoryDay[];
  precisions?: string;
  constraints?: MealSuggestionsRequest['constraints'];
}

/** A validated reply item: ids resolved against the pool/selected meals, portion repaired (§6). */
export interface ParsedItem {
  food_id: string;
  meal_id: string;
  portion_id: string | null;
}

/** A validated proposal (≥ 1 surviving item). */
export interface ParsedProposal {
  items: ParsedItem[];
}

/** Parse outcome — mirrors `DishPhotoParseResult`. `ok:false` ⇒ the service maps to
 *  `ai_bad_response` (no parseable/valid proposal, §6 / §7). */
export type ChefParseResult = { ok: true; proposals: ParsedProposal[] } | { ok: false };
