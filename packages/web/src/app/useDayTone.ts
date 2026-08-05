import { useQuery } from '@tanstack/react-query';
import type { DayTone } from '@macronome/shared';
import { daysApi } from '../api/days';
import { effectiveTodayIso } from '../lib/effectiveDay';

// The current day's compliance tone for the app frame (B-262). It always tracks TODAY — the
// same effective day the rest of the app defaults to (03:00 rollover, DB-1/B-134) — never the
// day being browsed: it is a standing reminder, so navigating the Journal must not repaint it.
//
// It reads the dedicated read-only endpoint rather than the day sheet: `GET /days/:date` writes
// (it re-persists the live snapshot), and polling that on every focus would turn a passive
// indicator into a write. The value is server-computed; nothing is derived here (rule 2).

/** Refetch cadence — slow on purpose: the tone also refreshes on window focus. */
const TONE_STALE_MS = 60_000;

export function useDayTone(): DayTone {
  const date = effectiveTodayIso();
  const query = useQuery({
    queryKey: ['day-tone', date],
    queryFn: () => daysApi.tone(date),
    staleTime: TONE_STALE_MS,
    refetchOnWindowFocus: true,
  });
  // Before the first response there is nothing to claim about the day: `none` renders as the
  // ordinary border, so the rule never flashes a colour it might have to take back.
  return query.data?.tone ?? 'none';
}
