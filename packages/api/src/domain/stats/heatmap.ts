import type { HeatmapCell } from '@macronome/shared';
import { addDays, heatStatus, type DayStat } from './util.js';

// Calendar heatmap (spec/logic/stats-adherence.md §3): one cell per calendar date of the
// selected year — green OK / orange NOK-déficit / red NOK-surplus (or unknown burn) / grey
// not-logged (B-167). Logged days carry an effective verdict + sub-tone; every other date is
// `none`. Summary days are logged like any other.

/** One cell per date Jan 1 → Dec 31 of `year`; logged dates take their status + kcal,
 * else `none`/`null`. */
export function heatmap(loggedOfYear: DayStat[], year: number): HeatmapCell[] {
  const byDate = new Map(loggedOfYear.map((s) => [s.date, s] as const));
  const cells: HeatmapCell[] = [];
  const last = `${year}-12-31`;
  for (let date = `${year}-01-01`; date <= last; date = addDays(date, 1)) {
    const stat = byDate.get(date);
    cells.push({ date, status: stat ? heatStatus(stat) : 'none', kcal: stat?.kcal ?? null });
  }
  return cells;
}
