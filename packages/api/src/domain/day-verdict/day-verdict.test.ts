import { expect, test } from 'vitest';
import { autoVerdict, calorieStatus, dayKcal, effectiveVerdict } from './verdict.js';
import { resolveSnapshot } from './snapshot.js';

// Neutral CI oracles from spec/logic/day-snapshot-verdict.md §5 (range 1900–2100) and
// the §2 snapshot composition (canonical 80 kg, target 1.8/0.8 → matches targets-macros).
const round1 = (n: number): number => Number(n.toFixed(1));

test('auto verdict — OK / NOK(DÉPASSÉ) / NOK(SOUS) (§5)', () => {
  expect(autoVerdict(2000, 1900, 2100)).toBe('OK');
  expect(calorieStatus(2000, 1900, 2100)).toBe('OK');

  expect(autoVerdict(2200, 1900, 2100)).toBe('NOK');
  expect(calorieStatus(2200, 1900, 2100)).toBe('DEPASSE');

  expect(autoVerdict(0, 1900, 2100)).toBe('NOK');
  expect(calorieStatus(0, 1900, 2100)).toBe('SOUS');
});

test('dayKcal sums consumed entry kcal; pantry zero contributes 0', () => {
  expect(dayKcal([500, 270, 180, 0])).toBe(950);
  expect(dayKcal([])).toBe(0);
});

test('effective verdict = override ?? auto (§6)', () => {
  expect(effectiveVerdict('NOK', 'OK')).toBe('NOK');
  expect(effectiveVerdict(null, 'OK')).toBe('OK');
  expect(effectiveVerdict(null, null)).toBeNull();
});

test('resolveSnapshot composes cal range + macro thresholds on the day weight (§2)', () => {
  const snap = resolveSnapshot({
    target: { calorieMin: 1900, calorieMax: 2100, proteinGPerKg: 1.8, fatGPerKg: 0.8 },
    weightKg: 80,
  });
  expect(snap.cal_min).toBe(1900);
  expect(snap.cal_max).toBe(2100);
  expect(round1(snap.protein_floor_g!)).toBe(144);
  expect(round1(snap.fat_floor_g!)).toBe(64);
  expect(round1(snap.carb_ceiling_g!)).toBe(237);
});

test('resolveSnapshot leaves thresholds null without a weigh-in', () => {
  const snap = resolveSnapshot({
    target: { calorieMin: 1900, calorieMax: 2100, proteinGPerKg: 1.8, fatGPerKg: 0.8 },
    weightKg: null,
  });
  expect(snap.cal_min).toBe(1900);
  expect(snap.protein_floor_g).toBeNull();
  expect(snap.carb_ceiling_g).toBeNull();
});
