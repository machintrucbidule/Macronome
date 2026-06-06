import type { HeatmapCell } from '@macronome/shared';
import { addDays, type DayStat } from './util.js';

// Calendar heatmap (spec/logic/stats-adherence.md §3): one cell per calendar date of the
// selected year — green OK / red NOK / grey not-logged. Logged days carry an effective
// verdict; every other date of the year is `none`. Summary days are logged like any other.

/** One cell per date Jan 1 → Dec 31 of `year`; logged dates take their verdict + kcal,
 * else `none`/`null`. */
export function heatmap(loggedOfYear: DayStat[], year: number): HeatmapCell[] {
  const byDate = new Map(loggedOfYear.map((s) => [s.date, s] as const));
  const cells: HeatmapCell[] = [];
  const last = `${year}-12-31`;
  for (let date = `${year}-01-01`; date <= last; date = addDays(date, 1)) {
    const stat = byDate.get(date);
    cells.push({ date, status: stat?.verdict ?? 'none', kcal: stat?.kcal ?? null });
  }
  return cells;
}
