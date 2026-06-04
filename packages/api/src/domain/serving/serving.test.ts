import { expect, test } from 'vitest';
import { resolveServedGrams, snapshotMacros } from './serving.js';

// Neutral oracles for serving resolution (00-conventions.md §Units). No personal data.

test('resolveServedGrams — g and ml are 1:1, kg ×1000', () => {
  expect(resolveServedGrams({ unit: 'g', quantity: 100 })).toBe(100);
  expect(resolveServedGrams({ unit: 'ml', quantity: 250 })).toBe(250); // 1 ml = 1 g
  expect(resolveServedGrams({ unit: 'kg', quantity: 1.5 })).toBe(1500);
});

test('resolveServedGrams — portion multiplies by the named portion grams', () => {
  expect(resolveServedGrams({ unit: 'portion', quantity: 2, portionGrams: 57 })).toBe(114);
});

test('resolveServedGrams — portion without grams is a programmer error', () => {
  expect(() => resolveServedGrams({ unit: 'portion', quantity: 2 })).toThrow(
    'portion_grams_required',
  );
});

test('snapshotMacros — scales per-100 g macros by grams/100', () => {
  const snap = snapshotMacros({ kcal: 200, fat: 10, carb: 20, protein: 5 }, 250);
  expect(snap).toEqual({ kcal: 500, fat: 25, carb: 50, protein: 12.5 });
});
