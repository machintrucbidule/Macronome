// Hard-coded response-format contract (spec/logic/ai-dish-photo-macros.md §3). App-owned,
// English, NOT stored in settings — appended verbatim to the user prompt at call time so the
// return format is guaranteed regardless of the user-editable scope text. Encodes three product
// decisions: aggregate multiple dishes into one result + always estimate every field, no nulls
// (DECISIONS B-118); surface a "no food" outcome via the `detected` flag instead of leaking a
// sentinel into dish_name (DECISIONS DS-1/B-160).
export const DISH_PHOTO_FORMAT_INSTRUCTION =
  'Respond with ONLY one JSON object, no markdown, no commentary, matching exactly: ' +
  '{"detected":boolean,"dish_name":string,"calories_kcal":number,"weight_g":number,"fat_g":number,"carb_g":number,"protein_g":number}. ' +
  'Set "detected" to false ONLY when no food can be identified at all (in the photo(s) and/or ' +
  'description); otherwise set it to true and estimate every other field. ' +
  'All numbers are totals for the whole dish, based on the provided photo(s) and/or written ' +
  'description, in SI units (grams for weight and macros, kcal for energy), as plain numbers (no ' +
  'units, no quotes). When "detected" is true, always give your best estimate for every field — ' +
  'never omit a field or use null; when "detected" is false the numeric fields may be 0. If several ' +
  'dishes appear, aggregate them into one result and combine their names in dish_name.';
