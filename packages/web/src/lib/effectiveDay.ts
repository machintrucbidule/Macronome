// Client display-only "effective day" (DB-1 / B-134). Before 03:00 local the app still treats the
// previous calendar day as "today" — so opening Repas/Journal just after midnight lands on the day
// the user was still logging. This is DISPLAY ONLY: the server stays calendar-based (freeze boundary,
// stats future-day exclusion, verdict snapshots are unchanged — spec/logic/00-conventions.md). Pure.

/** Local hour before which the previous calendar date is still the default day. */
export const DAY_ROLLOVER_HOUR = 3;

/** The effective default day as local YYYY-MM-DD: the previous calendar date until 03:00, else today. */
export function effectiveTodayIso(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
