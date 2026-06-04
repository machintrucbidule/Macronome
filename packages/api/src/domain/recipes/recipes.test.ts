import { expect, test } from 'vitest';
import type { MacroPer100g } from '../serving/serving.js';
import { aggregateMacros, type IngredientInput } from './aggregate.js';
import { buildDerivedFood, per100, perPortion, weightPerPortion } from './derive.js';
import { wouldCreateCycle, type Adjacency } from './cycle.js';

const round1 = (n: number): number => Number(n.toFixed(1));

// Neutral "Sample bake" oracle (spec/logic/recipes-derived-food.md §6). Each ingredient
// is expressed by its per-100 g macros (= line macros scaled from its grams) so the
// aggregate reproduces the worked line totals.
const per100From = (macros: MacroPer100g, grams: number): MacroPer100g => ({
  kcal: (macros.kcal / grams) * 100,
  fat: (macros.fat / grams) * 100,
  carb: (macros.carb / grams) * 100,
  protein: (macros.protein / grams) * 100,
});

const SAMPLE_BAKE: IngredientInput[] = [
  {
    per100g: per100From({ kcal: 400, fat: 10, carb: 50, protein: 20 }, 200),
    quantity: 200,
    unit: 'g',
  },
  {
    per100g: per100From({ kcal: 150, fat: 2, carb: 30, protein: 5 }, 300),
    quantity: 300,
    unit: 'g',
  },
  {
    per100g: per100From({ kcal: 90, fat: 1, carb: 18, protein: 3 }, 100),
    quantity: 100,
    unit: 'g',
  },
];

test('aggregate: total grams + macros over the Sample bake (§6)', () => {
  const { totalIngredientGrams, totalMacros } = aggregateMacros(SAMPLE_BAKE);
  expect(totalIngredientGrams).toBe(600);
  expect(round1(totalMacros.kcal)).toBe(640.0);
  expect(round1(totalMacros.fat)).toBe(13.0);
  expect(round1(totalMacros.carb)).toBe(98.0);
  expect(round1(totalMacros.protein)).toBe(28.0);
});

test('per-100 g concentration at the default batch weight (600 g → 106.7 kcal)', () => {
  const { totalMacros } = aggregateMacros(SAMPLE_BAKE);
  expect(round1(per100(totalMacros, 600).kcal)).toBe(106.7);
});

test('per-portion: 4 servings → 150 g / 160.0 kcal', () => {
  const { totalMacros } = aggregateMacros(SAMPLE_BAKE);
  expect(weightPerPortion(600, 4)).toBe(150);
  expect(round1(perPortion(totalMacros, 4).kcal)).toBe(160.0);
});

test('correcting the batch weight changes per-100 g but not per-portion macros', () => {
  const { totalMacros } = aggregateMacros(SAMPLE_BAKE);
  // Cooked bake weighed at 900 g.
  expect(round1(per100(totalMacros, 900).kcal)).toBe(71.1);
  // Per-portion macros unchanged (total macros do not change with water loss).
  expect(round1(perPortion(totalMacros, 4).kcal)).toBe(160.0);
  // Per-portion weight does change with the batch correction.
  expect(weightPerPortion(900, 4)).toBe(225);
});

test('buildDerivedFood: per-100 g macros + auto "portion" = batch / servings', () => {
  const { totalMacros } = aggregateMacros(SAMPLE_BAKE);
  const derived = buildDerivedFood(totalMacros, 600, 4);
  expect(round1(derived.per100g.kcal)).toBe(106.7);
  expect(derived.portionLabel).toBe('portion');
  expect(derived.portionGrams).toBe(150);
});

test('transitive cycle is rejected (A→B→C, adding C→A)', () => {
  const adjacency: Adjacency = new Map([
    ['A', new Set(['B'])],
    ['B', new Set(['C'])],
  ]);
  // C referencing A closes the loop A→B→C→A.
  expect(wouldCreateCycle('C', 'A', adjacency)).toBe(true);
  // Direct self-reference is also a cycle.
  expect(wouldCreateCycle('A', 'A', adjacency)).toBe(true);
  // A→C is a harmless diamond, not a cycle.
  expect(wouldCreateCycle('A', 'C', adjacency)).toBe(false);
});
