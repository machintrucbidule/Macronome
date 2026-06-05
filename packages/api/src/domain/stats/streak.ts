import type { DayStat } from './util.js';

// Streaks over the ORDERED sequence of logged days, counting back from the latest
// (spec/logic/stats-adherence.md §6–7). Unlogged days never appear here, so they are
// naturally skipped (neither counted nor breaking). A run ends at the first opposite verdict.

/** Logged days sorted most-recent first (does not mutate the input). */
function descending(logged: DayStat[]): DayStat[] {
  return [...logged].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Run of consecutive effective-OK logged days counting back from the latest. */
export function currentOkStreak(logged: DayStat[]): number {
  let run = 0;
  for (const s of descending(logged)) {
    if (s.verdict !== 'OK') break;
    run += 1;
  }
  return run;
}

/** Run of consecutive most-recent NOK logged days (the off-target signal, §7). */
export function currentNokRun(logged: DayStat[]): number {
  let run = 0;
  for (const s of descending(logged)) {
    if (s.verdict !== 'NOK') break;
    run += 1;
  }
  return run;
}
