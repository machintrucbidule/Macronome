import { useQuery } from '@tanstack/react-query';
import type { DayTone } from '@macronome/shared';
import { daysApi } from '../api/days';
import { useEffectiveTodayIso } from '../lib/useEffectiveTodayIso';
import { DAY_TONE_KEY } from '../lib/day-scope';

// The current day's compliance tone for the app frame (B-262). It always tracks TODAY — the
// same effective day the rest of the app defaults to (03:00 rollover, DB-1/B-134) — never the
// day being browsed: it is a standing reminder, so navigating the Journal must not repaint it.
//
// It reads the dedicated read-only endpoint rather than the day sheet: `GET /days/:date` writes
// (it re-persists the live snapshot), and polling that on every focus would turn a passive
// indicator into a write. The value is server-computed; nothing is derived here (rule 2).
//
// B-294 — the date comes from the REACTIVE hook, not a bare `effectiveTodayIso()` call: the shell
// is a layout route mounted once per session, so without it an app left open past 03:00 keeps
// yesterday's key, colour and badge.

/** Refetch cadence — slow on purpose: the tone also refreshes on window focus. */
const TONE_STALE_MS = 60_000;

/** Safety net (B-294). The only value in the app that must stay true without the user ever
 *  visiting the screen that owns it: it lives in the window frame, on every screen, and a day can
 *  be changed from another device entirely (a meal logged on the phone must reach the open desktop
 *  window). Invalidation on every local write is the correctness guarantee; this covers the rest.
 *  `refetchIntervalInBackground` stays false — a hidden window polls nothing. */
const TONE_POLL_MS = 5 * 60_000;

export function useDayTone(): DayTone {
  const date = useEffectiveTodayIso();
  const query = useQuery({
    queryKey: [DAY_TONE_KEY, date],
    queryFn: () => daysApi.tone(date),
    staleTime: TONE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: TONE_POLL_MS,
  });
  // Before the first response there is nothing to claim about the day: `none` renders as the
  // ordinary border, so the rule never flashes a colour it might have to take back.
  return query.data?.tone ?? 'none';
}
