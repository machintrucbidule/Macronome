import { expect, test } from 'vitest';
import { dayStat } from './day-stat.js';
import type { LightDay } from '../data/repositories/day-stat.repo.js';

// The logged-day rule for stats (spec/logic/day-snapshot-verdict.md §8, stats-adherence.md §1):
// a day counts only when it carries a calorie value. Critically, a detailed day whose lines sum
// to 0 — a comment-only / cleared / all-leftover "red" day — must be EXCLUDED, even though the
// qty-0 garde-manger pre-fill leaves entry rows behind (otherwise it would pollute the OK-rate
// as a phantom NOK-SOUS).
const snapshot = { cal_min: 1900, cal_max: 2100 };

function detailed(entries: { snapKcal: number }[]): LightDay {
  return {
    date: '2026-03-01',
    kind: 'detailed',
    summaryKcal: null,
    verdictOverride: null,
    activityLevel: 'sedentary',
    comment: null,
    snapshot,
    entries: entries.map((e, i) => ({ id: `e${i}`, snapKcal: e.snapKcal, servedGrams: 100 })),
    groups: [],
  };
}

test('detailed day with consumed kcal > 0 is logged (green)', () => {
  const s = dayStat(detailed([{ snapKcal: 500 }, { snapKcal: 450 }]));
  expect(s).not.toBeNull();
  expect(s!.kcal).toBe(950);
  expect(s!.verdict).toBe('NOK'); // 950 < 1900 → SOUS
});

test('detailed day with only qty-0 pre-fill rows (Σ=0) is NOT logged → excluded', () => {
  // Comment-only / cleared day: entry rows exist but contribute 0 kcal.
  expect(dayStat(detailed([{ snapKcal: 0 }, { snapKcal: 0 }]))).toBeNull();
});

test('detailed day with no entries at all is NOT logged', () => {
  expect(dayStat(detailed([]))).toBeNull();
});

test('summary day with a total is logged (yellow); null total is excluded', () => {
  const base = detailed([]);
  const withTotal: LightDay = { ...base, kind: 'summary', summaryKcal: 2000 };
  const s = dayStat(withTotal);
  expect(s).not.toBeNull();
  expect(s!.kcal).toBe(2000);
  expect(s!.verdict).toBe('OK'); // 1900 ≤ 2000 ≤ 2100

  const noTotal: LightDay = { ...base, kind: 'summary', summaryKcal: null };
  expect(dayStat(noTotal)).toBeNull();
});
