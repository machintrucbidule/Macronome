import type { RollingResponse, RollingWindow } from '@macronome/shared';
import { addDays, latestDate, mean, meanBand, okRate, vsTarget, type DayStat } from './util.js';

// Rolling averages (spec/logic/stats-adherence.md §2). Anchor L = latest logged day;
// window N = calendar dates [L−N+1, L]; avg over logged days in the window; ok_rate over
// logged days in the window (unlogged excluded, never NOK). Always "as of" L. vs_target judges
// the window average against the MEAN of the per-day frozen bands over the window (B-100), so a
// long window is not falsely "above" today's (possibly lower) band when older targets applied.

export interface WindowStats {
  avg: number | null;
  ok_rate: number | null;
  count: number;
}

/** Logged days falling in the last N calendar days up to and including L. */
export function inWindow(logged: DayStat[], anchor: string, n: number): DayStat[] {
  const from = addDays(anchor, -(n - 1));
  return logged.filter((s) => s.date >= from && s.date <= anchor);
}

/** Avg / ok-rate / count for the trailing N-day window ending at `anchor`. */
export function windowStats(logged: DayStat[], anchor: string, n: number): WindowStats {
  const days = inWindow(logged, anchor, n);
  return { avg: mean(days.map((s) => s.kcal)), ok_rate: okRate(days), count: days.length };
}

/** The rolling response: one window per N, all as of the latest logged day. */
export function rolling(logged: DayStat[], windows: readonly number[]): RollingResponse {
  const anchor = latestDate(logged);
  const cards: RollingWindow[] = windows.map((window) => {
    if (anchor === null) return { window, avg_kcal: null, ok_rate: null, vs_target: null };
    const days = inWindow(logged, anchor, window);
    return {
      window,
      avg_kcal: mean(days.map((s) => s.kcal)),
      ok_rate: okRate(days),
      vs_target: vsTarget(mean(days.map((s) => s.kcal)), meanBand(days)),
    };
  });
  return { as_of: anchor, windows: cards };
}
