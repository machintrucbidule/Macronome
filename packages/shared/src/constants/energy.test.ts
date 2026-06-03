import { expect, test } from 'vitest';
import { KCAL_PER_G, KCAL_PER_KG } from './energy.js';

// Sample neutral oracle proving the unit-test harness (testing.md §1).
// These are shared constants, not personal data — safe to ship in CI.
test('Atwater energy factors (neutral oracle)', () => {
  expect(KCAL_PER_G.fat).toBe(9);
  expect(KCAL_PER_G.carb).toBe(4);
  expect(KCAL_PER_G.protein).toBe(4);
});

test('energy per kg of body mass (neutral oracle)', () => {
  expect(KCAL_PER_KG).toBe(7700);
});
