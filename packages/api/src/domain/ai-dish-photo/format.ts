// Hard-coded response-format contract (spec/logic/ai-dish-photo-macros.md §3). App-owned,
// English, NOT stored in settings — appended verbatim to the user prompt at call time so the
// return format is guaranteed regardless of the user-editable scope text. Encodes two product
// decisions (DECISIONS B-118): aggregate multiple dishes into one result; always estimate
// every field (no nulls).
export const DISH_PHOTO_FORMAT_INSTRUCTION =
  'Respond with ONLY one JSON object, no markdown, no commentary, matching exactly: ' +
  '{"dish_name":string,"calories_kcal":number,"weight_g":number,"fat_g":number,"carb_g":number,"protein_g":number}. ' +
  'All numbers are totals for the whole dish, based on the provided photo(s) and/or written ' +
  'description, in SI units (grams for weight and macros, kcal for energy), as plain numbers (no ' +
  'units, no quotes). Always give your best estimate for every field — never omit a field or use ' +
  'null. If several dishes appear, aggregate them into one result and combine their names in dish_name.';
