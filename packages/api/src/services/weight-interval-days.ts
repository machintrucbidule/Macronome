import type { IntervalDay, IntervalDaysResponse } from '@macronome/shared';
import { dayReadRepo, type DayAggregate } from '../data/repositories/day-read.repo.js';
import { computeDayTotals } from './day-assembler.js';
import { eachDate } from './day-context.js';

// Interval-days recap (spec/api/weight-targets-stats-settings.md §Weight, B-225). A read-only
// per-day view of a period's interval: every calendar day of [start,end] INCLUSIVE (a display
// convention wider than the (prev,end] stats span — logic/weight-periods-trajectory.md §2.1).
// Reuses the day read-stack (readRange + computeDayTotals) so the figures can never drift from
// the Journal/Repas screens; the API returns the recap and the web only renders it (rule 2).

const isoOf = (a: DayAggregate): string => a.dayLog.date.toISOString().slice(0, 10);
const num = (d: { toString(): string }): number => Number(d.toString());

/** Map a stored day to its recap row. Mirrors the Journal row's kcal/macros: a summary day
 *  carries only kcal (macros null); a detailed day computes both from its meals. */
function toIntervalDay(aggregate: DayAggregate): IntervalDay {
  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const totals = isSummary ? null : computeDayTotals(aggregate);
  const kcal = isSummary ? num(dayLog.summaryKcal ?? 0) : totals!.kcal;
  return {
    date: isoOf(aggregate),
    kcal,
    macros: totals ? { L: totals.fat, G: totals.carb, P: totals.protein } : null,
    comment: dayLog.comment,
  };
}

/** Every calendar day of `[start,end]` inclusive, oldest first (B-225). Days with no `day_log`
 *  row are filled as empty (all-null) so the whole interval is always represented. User-scoped
 *  via `readRange` (cross-tenant days never leak → an interval with no data is all-null). */
export async function intervalDays(
  userId: string,
  start: string,
  end: string,
): Promise<IntervalDaysResponse> {
  const aggregates = await dayReadRepo.readRange(userId, start, end);
  const byDate = new Map(aggregates.map((a) => [isoOf(a), a]));
  const data = eachDate(start, end).map((date): IntervalDay => {
    const agg = byDate.get(date);
    return agg ? toIntervalDay(agg) : { date, kcal: null, macros: null, comment: null };
  });
  return { data };
}
