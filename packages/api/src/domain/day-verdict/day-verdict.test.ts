import { expect, test } from 'vitest';
import { autoVerdict, calorieStatus, dayKcal, effectiveVerdict, kcalBandGap } from './verdict.js';
import { resolveSnapshot } from './snapshot.js';
import { dayState, isLoggedDay } from './state.js';

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

test('kcalBandGap — signed écart vs the frozen band (B-138)', () => {
  // inside the band (OK) → nothing to show
  expect(kcalBandGap(2000, 1900, 2100)).toBeNull();
  expect(kcalBandGap(1900, 1900, 2100)).toBeNull(); // on the lower edge = OK
  expect(kcalBandGap(2100, 1900, 2100)).toBeNull(); // on the upper edge = OK
  // below cal_min → negative écart (green, rendered client-side)
  expect(kcalBandGap(1500, 1900, 2100)).toBe(-400);
  // above cal_max → positive écart (red)
  expect(kcalBandGap(2400, 1900, 2100)).toBe(300);
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

// Day-state oracles — the worked examples from spec/logic/day-snapshot-verdict.md §8.
test('dayState — calorie-driven derivation (§8 worked examples)', () => {
  // date ≤ today (isFuture=false)
  expect(dayState({ kind: 'detailed', dayKcal: 950, isFuture: false })).toBe('green');
  expect(dayState({ kind: 'summary', dayKcal: 1800, isFuture: false })).toBe('yellow');
  expect(dayState({ kind: null, dayKcal: 0, isFuture: false })).toBe('red'); // no row
  expect(dayState({ kind: 'detailed', dayKcal: 0, isFuture: false })).toBe('red'); // cleared / pantry-only
  // future days (isFuture=true)
  expect(dayState({ kind: null, dayKcal: 0, isFuture: true })).toBe('none');
  expect(dayState({ kind: 'detailed', dayKcal: 1500, isFuture: true })).toBe('green'); // planned
  expect(dayState({ kind: 'summary', dayKcal: 1600, isFuture: true })).toBe('yellow');
});

test('isLoggedDay — only calorie-bearing days whose date has arrived count (§8)', () => {
  expect(isLoggedDay({ kind: 'detailed', dayKcal: 950, isFuture: false })).toBe(true);
  expect(isLoggedDay({ kind: 'summary', dayKcal: 1800, isFuture: false })).toBe(true);
  expect(isLoggedDay({ kind: 'detailed', dayKcal: 0, isFuture: false })).toBe(false); // red
  expect(isLoggedDay({ kind: null, dayKcal: 0, isFuture: false })).toBe(false); // red, no row
  expect(isLoggedDay({ kind: 'detailed', dayKcal: 1500, isFuture: true })).toBe(false); // future green
  expect(isLoggedDay({ kind: 'summary', dayKcal: 1600, isFuture: true })).toBe(false); // future yellow
  expect(isLoggedDay({ kind: null, dayKcal: 0, isFuture: true })).toBe(false); // none
});
