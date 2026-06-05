import type { BestMonth } from '@macronome/shared';
import { okRate, type DayStat } from './util.js';

// Best month (spec/logic/stats-adherence.md §6, OPEN_GAPS #12): the month with the
// highest ok_rate among months with ≥ minDays logged days. Ties → more logged days →
// most recent. Computed over ALL history (a key figure, not year-scoped).

interface Candidate {
  month: string; // YYYY-MM
  ok_rate: number;
  logged_days: number;
}

/** Truthy when `a` is a strictly better best-month candidate than `b` (tie-break order). */
function better(a: Candidate, b: Candidate): boolean {
  if (a.ok_rate !== b.ok_rate) return a.ok_rate > b.ok_rate;
  if (a.logged_days !== b.logged_days) return a.logged_days > b.logged_days;
  return a.month > b.month; // most recent
}

/** Highest-ok_rate eligible month, or null when none reaches minDays logged days. */
export function bestMonth(logged: DayStat[], minDays: number): BestMonth | null {
  const byMonth = new Map<string, DayStat[]>();
  for (const s of logged) {
    const month = s.date.slice(0, 7);
    const list = byMonth.get(month);
    if (list) list.push(s);
    else byMonth.set(month, [s]);
  }
  let best: Candidate | null = null;
  for (const [month, days] of byMonth) {
    if (days.length < minDays) continue;
    const candidate: Candidate = { month, ok_rate: okRate(days) ?? 0, logged_days: days.length };
    if (best === null || better(candidate, best)) best = candidate;
  }
  return best;
}
