import { expect, test } from 'vitest';
import { carbCeilingG } from './carb-ceiling.js';
import { fatFloorG, proteinFloorG } from './floors.js';
import { suggestRange } from './suggest.js';

// Neutral CI oracles from spec/logic/targets-macros.md §3–5 (current weight 80 kg,
// no personal data). Macro grams at 1-decimal display precision.
const round1 = (n: number): number => Number(n.toFixed(1));

test('floors + carb ceiling (§3)', () => {
  const protein = proteinFloorG(1.8, 80);
  const fat = fatFloorG(0.8, 80);
  expect(round1(protein)).toBe(144);
  expect(round1(fat)).toBe(64);
  const carb = carbCeilingG({ calorieMax: 2100, proteinFloorG: protein, fatFloorG: fat });
  expect(round1(carb)).toBe(237);
});

test('carb ceiling ≤ 0 is returned as-is, never clamped, never throws (§4)', () => {
  const protein = proteinFloorG(2.0, 80); // 160 g
  const fat = fatFloorG(1.0, 80); // 80 g
  const carb = carbCeilingG({ calorieMax: 1200, proteinFloorG: protein, fatFloorG: fat });
  expect(round1(carb)).toBe(-40);
});

test('suggest a range from burn − desired deficit (§5)', () => {
  expect(suggestRange(2076, -300)).toEqual({ calorieMin: 1726, calorieMax: 1826 });
});
