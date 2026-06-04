import { expect, test } from 'vitest';
import { bmi } from './bmi.js';
import { deriveEma } from './ema.js';
import { derivePeriods } from './periods.js';
import { projectGoalDate } from './projection.js';
import { deriveTrajectory, ecart } from './trajectory.js';

// Neutral oracles from spec/logic/weight-periods-trajectory.md (current weight ~80 kg,
// no personal data). Display precision is 1 decimal where the spec rounds.
const round1 = (n: number): number => Number(n.toFixed(1));

test('EMA over the weigh-in series, seeded at the first weight (§3)', () => {
  const ema = deriveEma([80.0, 79.0, 78.0]); // α = 0.35
  expect(ema[0]).toBe(80.0);
  expect(round1(ema[1]!)).toBe(79.7);
  expect(round1(ema[2]!)).toBe(79.1);
});

test('broken-line trajectory driven by per-period diet flag (§4)', () => {
  const traj = deriveTrajectory({
    anchor: 80.0,
    rateKgPerWeek: 1.0,
    goalWeight: 72,
    periods: [
      { days: 7, dietFlag: 'in_diet' }, // drop 1.0 → 79.0
      { days: 7, dietFlag: 'not_in_diet' }, // flat → 79.0
      { days: 14, dietFlag: 'in_diet' }, // drop 2.0 → 77.0
    ],
  });
  expect(traj.map(round1)).toEqual([80.0, 79.0, 79.0, 77.0]);
  // real 78.0 at P3 → écart = 78.0 − 77.0 = +1.0 (behind plan)
  expect(round1(ecart(78.0, traj[3]!))).toBe(1.0);
});

test('trajectory cap at the goal weight, no floor when goal absent (§4)', () => {
  const capped = deriveTrajectory({
    anchor: 73,
    rateKgPerWeek: 1.0,
    goalWeight: 72,
    periods: [{ days: 14, dietFlag: 'in_diet' }], // drop 2.0 → 71 → capped at 72
  });
  expect(round1(capped[1]!)).toBe(72.0);
  const uncapped = deriveTrajectory({
    anchor: 73,
    rateKgPerWeek: 1.0,
    goalWeight: null,
    periods: [{ days: 14, dietFlag: 'in_diet' }], // no cap → 71
  });
  expect(round1(uncapped[1]!)).toBe(71.0);
});

test('BMI from weight and height (§5)', () => {
  expect(round1(bmi(80, 180))).toBe(24.7);
});

test('projection from the recent EMA trend (§6)', () => {
  // slope −0.05 kg/day, current ema 80.0, goal 72 → 8.0 / 0.05 = 160 days
  const projected = projectGoalDate({
    points: [
      { x: 0, y: 80.4 },
      { x: 8, y: 80.0 },
    ],
    goalWeight: 72,
    maintien: false,
  });
  expect(projected.status).toBe('projected');
  expect(Math.round(projected.days!)).toBe(160);
});

test('projection edges: non-downward, already-reached, no goal, Maintien (§6)', () => {
  const flat = projectGoalDate({
    points: [
      { x: 0, y: 79 },
      { x: 8, y: 80 },
    ],
    goalWeight: 72,
    maintien: false,
  });
  expect(flat.status).toBe('non_baissiere');

  const reached = projectGoalDate({
    points: [
      { x: 0, y: 73 },
      { x: 8, y: 71.6 },
    ],
    goalWeight: 72,
    maintien: false,
  });
  expect(reached.status).toBe('atteint');

  expect(projectGoalDate({ points: [], goalWeight: null, maintien: false }).status).toBe('no_goal');
  expect(
    projectGoalDate({
      points: [
        { x: 0, y: 80 },
        { x: 8, y: 79.6 },
      ],
      goalWeight: 72,
      maintien: true,
    }).status,
  ).toBe('no_goal');
});

test('periods: span = date(next) − date(prev); single/empty → none (§1, §8)', () => {
  const entries = [
    { date: '2026-01-01', weightKg: 80, waistCm: 90, dietFlag: 'in_diet' as const, note: null },
    { date: '2026-01-08', weightKg: 79, waistCm: 89, dietFlag: 'in_diet' as const, note: 'x' },
  ];
  const periods = derivePeriods(entries);
  expect(periods).toHaveLength(1);
  expect(periods[0]).toMatchObject({
    startDate: '2026-01-01',
    endDate: '2026-01-08',
    days: 7,
    weightStart: 80,
    weightEnd: 79,
    waist: 89,
    note: 'x',
  });

  expect(derivePeriods([entries[0]!])).toEqual([]);
  expect(derivePeriods([])).toEqual([]);
});
