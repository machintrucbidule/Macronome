import { expect, test } from 'vitest';
import { ageYears } from './age.js';
import { mifflinStJeor } from './bmr.js';
import { empiricalBurnPerDay, estimatedBurn } from './burn.js';
import { calorieMidpoint, deficitAtTarget, deficitPerDay, kgPerWeek } from './deficit.js';
import { recentAvgActivity } from './activity.js';

// Neutral CI oracles from spec/logic/metabolic-engine.md §1–6 (canonical profile
// 80 kg / 180 cm / 40 / male → BMR 1730; no personal data). Compared at display
// precision per 00-conventions.md (kcal integer, kg/week 2 decimals).
const round = (n: number, dp: number): number => Number(n.toFixed(dp));

test('age — whole years against the reference date (§1)', () => {
  expect(ageYears(new Date('1986-01-01'), new Date('2026-06-02'))).toBe(40);
});

test('BMR — Mifflin-St Jeor (§2)', () => {
  expect(mifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 40, sex: 'male' })).toBe(1730);
  expect(mifflinStJeor({ weightKg: 90, heightCm: 180, ageYears: 40, sex: 'male' })).toBe(1830);
});

test('estimated burn — BMR × activity (§3)', () => {
  expect(estimatedBurn(1730, 1.2)).toBe(2076);
  expect(estimatedBurn(1830, 1.3)).toBe(2379); // recent-avg activity 1.30
});

test('recent-average activity — mean of logged multipliers, sedentary fallback (§3)', () => {
  const avg = recentAvgActivity([1.2, 1.4]);
  expect(avg.insufficientData).toBe(false);
  expect(round(avg.multiplier, 2)).toBe(1.3);
  expect(recentAvgActivity([])).toEqual({ multiplier: 1.2, insufficientData: true });
});

test('empirical burn per day — intake + lost_kg×7700/days (§4)', () => {
  expect(
    empiricalBurnPerDay({ avgDailyIntake: 2000, weightStartKg: 80, weightEndKg: 79.5, days: 7 }),
  ).toBe(2550);
});

test('deficit per day + kg/week — intake − estimated burn (§5)', () => {
  const deficit = deficitPerDay(2000, estimatedBurn(1730, 1.2)); // 2000 − 2076
  expect(deficit).toBe(-76);
  expect(round(kgPerWeek(deficit), 2)).toBe(-0.07);
});

test('deficit at target — midpoint intake − estimated burn (§6)', () => {
  const midpoint = calorieMidpoint(1900, 2100); // 2000
  expect(midpoint).toBe(2000);
  const deficit = deficitAtTarget(midpoint, 2379);
  expect(deficit).toBe(-379);
  expect(round(kgPerWeek(deficit), 2)).toBe(-0.34);
});
