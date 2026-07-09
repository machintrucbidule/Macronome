import { expect, test } from 'vitest';
import { buildMealSuggestionsMessages } from './assemble.js';
import { MEAL_SUGGESTIONS_FORMAT_INSTRUCTION } from './format.js';
import { parseMealSuggestions } from './parse.js';
import type { ChefContext, ChefFood } from './types.js';

// Neutral oracles from spec/logic/ai-meal-suggestions.md §6/§8 (parse) and §2 + Privacy §5
// (assemble). Pure — the LLM is exercised only via canned reply strings.

// --- Fixtures (synthetic; mirrors the §2.4 candidate table subset) -------------------------------

const F1: ChefFood = {
  food_id: 'F1',
  name: 'Blanc de poulet',
  per100g: { kcal: 110, protein: 23, fat: 2, carb: 0 },
  rating: 3,
  portions: [], // portionless (5 g step)
};
const F5: ChefFood = {
  food_id: 'F5',
  name: 'Œuf',
  per100g: { kcal: 140, protein: 12, fat: 10, carb: 1 },
  rating: 2,
  portions: [{ portion_id: 'pe5', label: 'œuf', grams: 57 }],
};

const POOL = new Map<string, ChefFood>([
  [F1.food_id, F1],
  [F5.food_id, F5],
]);
const MEAL_IDS = new Set(['M1', 'M2']);

const CTX: ChefContext = {
  remaining: { rem_cal_min: 630, rem_cal_max: 730, need_protein: 62, need_fat: 22, carb_room: 80 },
  meals: [
    { meal_id: 'M1', name: 'Déjeuner' },
    { meal_id: 'M2', name: 'Dîner' },
  ],
  candidates: [F1, F5],
  history: [{ date_offset: -3, meal_name: 'Déjeuner', foods: [{ name: 'Riz', qty: '150 g' }] }],
  precisions: 'pas de poisson',
};

// --- assemble (spec §2 + Privacy §5) -------------------------------------------------------------

/** Extract the single text part of the assembled `user` message. */
function textOf(prompt: string): string {
  const part = buildMealSuggestionsMessages(prompt, CTX)[0]?.content[0];
  if (!part || part.type !== 'text') throw new Error('expected a single text part');
  return part.text;
}

test('§5 assemble omits weight/BMI/identity (privacy)', () => {
  const body = textOf('Scope').toLowerCase();
  expect(body).not.toContain('weight');
  expect(body).not.toContain('bmi');
});

test('§2 assemble includes scope, remaining, names, precisions, and the format instruction', () => {
  const msgs = buildMealSuggestionsMessages('Scope text', CTX);
  expect(msgs).toHaveLength(1);
  const text = textOf('Scope text');
  expect(text.startsWith('Scope text')).toBe(true);
  for (const needle of [
    '630',
    '730',
    '62',
    '22',
    '80',
    'Blanc de poulet',
    'Œuf',
    'Déjeuner',
    'pas de poisson',
  ]) {
    expect(text).toContain(needle);
  }
  expect(text.endsWith(MEAL_SUGGESTIONS_FORMAT_INSTRUCTION)).toBe(true);
});

test('§2 assemble is deterministic (same input → identical output)', () => {
  expect(buildMealSuggestionsMessages('Scope', CTX)).toEqual(
    buildMealSuggestionsMessages('Scope', CTX),
  );
});

test('§2.2 assemble renders the ALREADY ON THE DAY section (name × qty); omitted when empty', () => {
  const withDay: ChefContext = {
    ...CTX,
    alreadyOnDay: [{ meal_name: 'Dîner', foods: [{ name: 'Blanc de poulet', qty: '200 g' }] }],
  };
  const part = buildMealSuggestionsMessages('Scope', withDay)[0]?.content[0];
  const text = part && part.type === 'text' ? part.text : '';
  expect(text).toContain('ALREADY ON THE DAY');
  expect(text).toContain('Blanc de poulet × 200 g');
  // The base CTX (no alreadyOnDay) must not carry the section.
  expect(textOf('Scope')).not.toContain('ALREADY ON THE DAY');
});

test('§2.2 assemble renders the AVOID section from avoidances (B-216); omitted when unset', () => {
  const part = buildMealSuggestionsMessages('Scope', CTX, 'peanuts, shellfish')[0]?.content[0];
  const text = part && part.type === 'text' ? part.text : '';
  expect(text).toContain('AVOID (user allergies/dislikes, free text)');
  expect(text).toContain('peanuts, shellfish');
  // No avoidances (or whitespace-only) → no section, and the format instruction still closes.
  expect(textOf('Scope')).not.toContain('AVOID (user allergies/dislikes');
  const blank = buildMealSuggestionsMessages('Scope', CTX, '   ')[0]?.content[0];
  const blankText = blank && blank.type === 'text' ? blank.text : '';
  expect(blankText).not.toContain('AVOID (user allergies/dislikes');
  expect(blankText.endsWith(MEAL_SUGGESTIONS_FORMAT_INSTRUCTION)).toBe(true);
});

// --- parse (spec §6 / §8) ------------------------------------------------------------------------

const CLEAN_3 =
  '{"proposals":[' +
  '{"items":[{"food_id":"F1","meal_id":"M1","portion_id":null}]},' +
  '{"items":[{"food_id":"F5","meal_id":"M1","portion_id":"pe5"}]},' +
  '{"items":[{"food_id":"F1","meal_id":"M1","portion_id":null},{"food_id":"F5","meal_id":"M2","portion_id":"pe5"}]}' +
  ']}';

test('§8.1 well-formed → 3 distinct proposals, ids resolved', () => {
  const r = parseMealSuggestions(CLEAN_3, POOL, MEAL_IDS);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.proposals).toHaveLength(3);
    expect(r.proposals[0]?.items[0]).toEqual({ food_id: 'F1', meal_id: 'M1', portion_id: null });
    expect(r.proposals[1]?.items[0]).toEqual({ food_id: 'F5', meal_id: 'M1', portion_id: 'pe5' });
  }
});

test('§8.2 fenced JSON → fence stripped, accepted', () => {
  const r = parseMealSuggestions('```json\n' + CLEAN_3 + '\n```', POOL, MEAL_IDS);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.proposals).toHaveLength(3);
});

test('§8.3 prose around a balanced object → first object taken', () => {
  const r = parseMealSuggestions('Sure! ' + CLEAN_3 + ' Hope it helps.', POOL, MEAL_IDS);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.proposals).toHaveLength(3);
});

test('§8.4 unknown food_id → item dropped (empty proposal dropped → zero valid → not ok)', () => {
  const r = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"NOPE","meal_id":"M1","portion_id":null}]}]}',
    POOL,
    MEAL_IDS,
  );
  expect(r.ok).toBe(false);
});

test('§6 unknown food_id dropped but a valid sibling item is kept', () => {
  const r = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"NOPE","meal_id":"M1","portion_id":null},{"food_id":"F1","meal_id":"M1","portion_id":null}]}]}',
    POOL,
    MEAL_IDS,
  );
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0]?.items).toEqual([{ food_id: 'F1', meal_id: 'M1', portion_id: null }]);
  }
});

test('§6 unknown meal_id → item dropped', () => {
  const r = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"F1","meal_id":"BAD","portion_id":null}]}]}',
    POOL,
    MEAL_IDS,
  );
  expect(r.ok).toBe(false);
});

test('§8.5 portionless food with a portion_id → coerced to null', () => {
  const r = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"F1","meal_id":"M1","portion_id":"pe5"}]}]}',
    POOL,
    MEAL_IDS,
  );
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.proposals[0]?.items[0]?.portion_id).toBeNull();
});

test('§6 portioned food with null/invalid portion_id → repaired to first portion', () => {
  const rNull = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"F5","meal_id":"M1","portion_id":null}]}]}',
    POOL,
    MEAL_IDS,
  );
  const rBad = parseMealSuggestions(
    '{"proposals":[{"items":[{"food_id":"F5","meal_id":"M1","portion_id":"ghost"}]}]}',
    POOL,
    MEAL_IDS,
  );
  expect(rNull.ok && rNull.proposals[0]?.items[0]?.portion_id).toBe('pe5');
  expect(rBad.ok && rBad.proposals[0]?.items[0]?.portion_id).toBe('pe5');
});

test('§8.6 zero valid proposals → not ok (ai_bad_response path)', () => {
  expect(parseMealSuggestions('{"proposals":[]}', POOL, MEAL_IDS).ok).toBe(false);
});

test('§8.x non-JSON → not ok', () => {
  expect(parseMealSuggestions('I cannot help with that.', POOL, MEAL_IDS).ok).toBe(false);
});

test('§8.7 two proposals with identical food-id multiset → de-duped to one', () => {
  const r = parseMealSuggestions(
    '{"proposals":[' +
      '{"items":[{"food_id":"F1","meal_id":"M1","portion_id":null}]},' +
      '{"items":[{"food_id":"F1","meal_id":"M2","portion_id":null}]}' +
      ']}',
    POOL,
    MEAL_IDS,
  );
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.proposals).toHaveLength(1);
});
