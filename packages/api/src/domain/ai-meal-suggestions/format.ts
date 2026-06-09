// Hard-coded response-format contract (spec/logic/ai-meal-suggestions.md §2.3). App-owned,
// English, NOT stored in settings — appended verbatim to the user prompt at call time so the
// return shape is guaranteed regardless of the user-editable scope text. The chef outputs only
// food/meal/portion ids (no quantities — the deterministic solver sets those, B-123 / D1).
export const MEAL_SUGGESTIONS_FORMAT_INSTRUCTION =
  'Respond with ONLY one JSON object, no markdown, no commentary, matching exactly: ' +
  '{"proposals":[{"items":[{"food_id":string,"meal_id":string,"portion_id":string|null}]}]}. ' +
  'Return exactly 3 proposals, each distinct from the others. Every food_id, meal_id, and ' +
  'portion_id MUST come from the provided lists; portion_id is null for a food without portions, ' +
  "otherwise one of that food's portion ids. Do NOT include quantities or any other field.";
