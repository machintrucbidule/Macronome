// AI meal-suggestions "chef" domain (spec/logic/ai-meal-suggestions.md, B-123). Pure prompt
// assembly + tolerant response parsing/validation; no I/O, no user scope. The chef picks foods;
// the `meal-solver/` accountant sets quantities; the service certifies the day total.
export { MEAL_SUGGESTIONS_FORMAT_INSTRUCTION } from './format.js';
export { buildMealSuggestionsMessages } from './assemble.js';
export { parseMealSuggestions } from './parse.js';
export {
  dayUsedFoods,
  type DayUsedEntry,
  type DayUsedMeal,
  type DayUsedResult,
} from './day-used.js';
export type {
  ChefContext,
  ChefFood,
  ChefMeal,
  ChefPortion,
  ChefParseResult,
  DayMealFoods,
  HistoryDay,
  ParsedItem,
  ParsedProposal,
} from './types.js';
