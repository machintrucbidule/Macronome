import { expect, test } from 'vitest';
import { dayUsedFoods, type DayUsedMeal } from './day-used.js';

// Day-awareness oracles (spec/logic/ai-meal-suggestions.md §2.2 + §3.1, B-125/B-126/B-127). Pure:
// from the working day's already-eaten entries, build the ALREADY ON THE DAY section and the
// >25 g re-proposal exclusion set. Threshold is the strictly-greater-than rule (25 g kept).

const NAMES = new Map<string, string>([
  ['poulet', 'Blanc de poulet'],
  ['huile', "Huile d'olive"],
  ['brocoli', 'Brocoli'],
]);

const meal = (meal_name: string, entries: DayUsedMeal['entries']): DayUsedMeal => ({
  meal_name,
  entries,
});

test('a food eaten >25 g today is excluded; a ≤25 g condiment is kept', () => {
  const r = dayUsedFoods(
    [
      meal('Déjeuner', [
        { food_id: 'poulet', custom_name: null, consumed_grams: 200 },
        { food_id: 'huile', custom_name: null, consumed_grams: 10 },
      ]),
    ],
    NAMES,
  );
  expect(r.excludedFoodIds).toEqual(['poulet']); // 200 > 25
  expect(r.excludedFoodIds).not.toContain('huile'); // 10 ≤ 25 → re-proposable
});

test('day-total is summed across meals (15 g + 15 g = 30 g → excluded)', () => {
  const r = dayUsedFoods(
    [
      meal('Déjeuner', [{ food_id: 'huile', custom_name: null, consumed_grams: 15 }]),
      meal('Dîner', [{ food_id: 'huile', custom_name: null, consumed_grams: 15 }]),
    ],
    NAMES,
  );
  expect(r.excludedFoodIds).toEqual(['huile']); // 30 > 25
});

test('exactly 25 g is kept (rule is strictly greater than the threshold)', () => {
  const r = dayUsedFoods(
    [meal('Déjeuner', [{ food_id: 'huile', custom_name: null, consumed_grams: 25 }])],
    NAMES,
  );
  expect(r.excludedFoodIds).toEqual([]);
});

test('custom entries (no food_id) are listed for awareness but never excluded', () => {
  const r = dayUsedFoods(
    [meal('Déjeuner', [{ food_id: null, custom_name: 'Moussaka maison', consumed_grams: 300 }])],
    NAMES,
  );
  expect(r.excludedFoodIds).toEqual([]);
  expect(r.alreadyOnDay).toEqual([
    { meal_name: 'Déjeuner', foods: [{ name: 'Moussaka maison', qty: '300 g' }] },
  ]);
});

test('ALREADY ON THE DAY resolves referenced names + rounds grams; skips zero-qty / unresolvable', () => {
  const r = dayUsedFoods(
    [
      meal('Déjeuner', [
        { food_id: 'poulet', custom_name: null, consumed_grams: 199.6 },
        { food_id: 'ghost', custom_name: null, consumed_grams: 50 }, // unresolvable name → skipped
        { food_id: 'brocoli', custom_name: null, consumed_grams: 0 }, // placeholder → skipped
      ]),
      meal('Petit-déjeuner', []), // empty meal → omitted
    ],
    NAMES,
  );
  expect(r.alreadyOnDay).toEqual([
    { meal_name: 'Déjeuner', foods: [{ name: 'Blanc de poulet', qty: '200 g' }] },
  ]);
  // 'ghost' has no resolvable name → not counted toward the exclusion either.
  expect(r.excludedFoodIds).toEqual(['poulet']);
});
