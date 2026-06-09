import { expect, test } from 'vitest';
import { effectiveTodayIso } from './effectiveDay';

// DB-1 / B-134 — the client display-only day rollover at 03:00 local.
test('before 03:00 the effective day is the previous calendar date', () => {
  expect(effectiveTodayIso(new Date(2026, 5, 9, 2, 30))).toBe('2026-06-08');
  expect(effectiveTodayIso(new Date(2026, 5, 9, 0, 1))).toBe('2026-06-08');
});

test('at or after 03:00 the effective day is the calendar date', () => {
  expect(effectiveTodayIso(new Date(2026, 5, 9, 3, 0))).toBe('2026-06-09');
  expect(effectiveTodayIso(new Date(2026, 5, 9, 9, 0))).toBe('2026-06-09');
  expect(effectiveTodayIso(new Date(2026, 5, 9, 23, 59))).toBe('2026-06-09');
});

test('the rollover crosses month and year boundaries', () => {
  expect(effectiveTodayIso(new Date(2026, 0, 1, 0, 30))).toBe('2025-12-31'); // Jan 1 02:00 → Dec 31
  expect(effectiveTodayIso(new Date(2026, 2, 1, 1, 0))).toBe('2026-02-28'); // Mar 1 → Feb 28
});
