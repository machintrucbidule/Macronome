import { describe, expect, it } from 'vitest';
import type { ProfileRow } from '../data/repositories/profile.repo.js';
import { buildOpenInterval, type LoggedDay } from './weight-periods.js';

// Oracle from spec/logic/weight-periods-trajectory.md §2.1 (B-176): the open interval
// (last weigh-in → today) reuses the §2 metabolics on the LAST weigh-in's weight, and dashes
// every figure that needs a closing weight. num() only calls toString() on heightCm, so a plain
// number stands in for the Prisma.Decimal here.
const PROFILE = {
  sex: 'male',
  birthdate: new Date('1986-01-01'),
  heightCm: 180,
} as unknown as ProfileRow;

// Today = last weigh-in (2026-04-01) + 3 days; age at today = 40.
const LOGGED: LoggedDay[] = [
  { date: '2026-04-02', kcal: 2000, activityLevel: 'sedentary' },
  { date: '2026-04-03', kcal: 2200, activityLevel: 'sedentary' },
  { date: '2026-04-04', kcal: 2100, activityLevel: 'sedentary' },
];

describe('buildOpenInterval (B-176, spec §2.1)', () => {
  it('computes the open interval over (last weigh-in, today] from the §2.1 oracle', () => {
    const open = buildOpenInterval({
      lastWeighIn: { date: '2026-04-01', weightKg: 80 },
      today: '2026-04-04',
      loggedDays: LOGGED,
      profile: PROFILE,
      dietFlag: 'in_diet',
      note: 'cutting',
    });
    expect(open).not.toBeNull();
    expect(open!.open).toBe(true);
    expect(open!.start_date).toBe('2026-04-01');
    expect(open!.end_date).toBe('2026-04-04');
    expect(open!.days).toBe(3);
    expect(open!.avg_intake).toBe(2100); // mean(2000,2200,2100)
    expect(open!.avg_activity).toBeCloseTo(1.2, 5);
    expect(open!.estimated_burn).toBeCloseTo(2076, 5); // BMR 1730 × 1.2
    expect(open!.deficit_per_day).toBeCloseTo(24, 5); // 2100 − 2076
    expect(open!.diet_flag).toBe('in_diet');
    expect(open!.note).toBe('cutting');
    // Dashed without a closing weight:
    expect(open!.weight_end).toBeNull();
    expect(open!.ema).toBeNull();
    expect(open!.delta).toBeNull();
    expect(open!.ecart_trajectoire).toBeNull();
    expect(open!.bmi).toBeNull();
    expect(open!.waist).toBeNull();
    expect(open!.empirical_burn).toBeNull();
  });

  it('returns null when no day is logged in the span (trigger not met)', () => {
    expect(
      buildOpenInterval({
        lastWeighIn: { date: '2026-04-01', weightKg: 80 },
        today: '2026-04-04',
        loggedDays: [],
        profile: PROFILE,
        dietFlag: 'in_diet',
        note: null,
      }),
    ).toBeNull();
  });

  it('returns null when the last weigh-in is today (span < 1 day)', () => {
    expect(
      buildOpenInterval({
        lastWeighIn: { date: '2026-04-04', weightKg: 80 },
        today: '2026-04-04',
        loggedDays: LOGGED,
        profile: PROFILE,
        dietFlag: 'in_diet',
        note: null,
      }),
    ).toBeNull();
  });
});
