import type { QueryClient } from '@tanstack/react-query';

// The single place that knows what a day-changing write must refresh (B-294).
//
// Before this existed, every mutation hook repeated `['day', date]` + `['journal']` by hand — and
// the app-frame tone query, added later under its own key, was simply forgotten in all six of
// them. TanStack compares key elements with `===`, so `['day-tone', d]` is a disjoint cache from
// `['day', d]`: the Repas verdict badge repainted instantly while the title-strip rule and the
// app-icon badge stayed frozen until the app was restarted. One helper, one thing to update.

export const DAY_KEY = 'day';
export const JOURNAL_KEY = 'journal';
export const DAY_TONE_KEY = 'day-tone';

/**
 * Invalidate the app-frame day signal (title-strip rule + app-icon badge).
 *
 * Always by prefix, never `[DAY_TONE_KEY, date]`: the rule tracks TODAY (the effectiveDay 03:00
 * rule), not the day being browsed, so the date a mutation carries is not necessarily the date
 * the tone query is keyed on. Invalidating the prefix is immune to that mismatch.
 */
export function invalidateDayTone(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: [DAY_TONE_KEY] });
}

/**
 * Invalidate everything a day-changing write can move: that day's sheet, the journal calendar,
 * and the app-frame tone. `date` narrows the day sheet to one day; omit it when the write can
 * affect any day (a pantry pin is reflected live on every day, a weigh-in feeds the burn gap).
 */
export function invalidateDayScope(qc: QueryClient, date?: string): void {
  void qc.invalidateQueries({ queryKey: date === undefined ? [DAY_KEY] : [DAY_KEY, date] });
  void qc.invalidateQueries({ queryKey: [JOURNAL_KEY] });
  invalidateDayTone(qc);
}
