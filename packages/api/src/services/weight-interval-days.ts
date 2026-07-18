import type {
  IntervalDay,
  IntervalDayState,
  IntervalDaysResponse,
  IntervalDaysSummary,
} from '@macronome/shared';
import { dayReadRepo, type DayAggregate } from '../data/repositories/day-read.repo.js';
import {
  autoVerdict,
  effectiveVerdict,
  type ResolvedSnapshot,
  type Verdict,
} from '../domain/day-verdict/index.js';
import { computeDayTotals } from './day-assembler.js';
import { eachDate } from './day-context.js';

// Interval-days recap (spec/api/weight-targets-stats-settings.md §Weight, B-225, enriched B-227). A
// read-only per-day view of a period's interval: every calendar day of [start,end] INCLUSIVE (a
// display convention wider than the (prev,end] stats span — logic/weight-periods-trajectory.md §2.1),
// each carrying its calories / macros / comment plus a verdict `state`, and an interval `summary`.
// Reuses the day read-stack (readRange + computeDayTotals) and the verdict domain (autoVerdict +
// effectiveVerdict, exactly as journal.ts:toRow) so nothing drifts; the API returns it, the web only
// renders it (rule 2).

const isoOf = (a: DayAggregate): string => a.dayLog.date.toISOString().slice(0, 10);
const num = (d: { toString(): string }): number => Number(d.toString());

/** The day's effective verdict as an interval state (B-227): `ok`/`nok` for a detailed logged day,
 *  `partiel` for a summary (Partiel) day. Caller handles the not-logged (`none`) case. */
function loggedState(aggregate: DayAggregate, isSummary: boolean, kcal: number): IntervalDayState {
  if (isSummary) return 'partiel';
  const snapshot = aggregate.dayLog.targetSnapshot as unknown as ResolvedSnapshot;
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const override = (aggregate.dayLog.verdictOverride ?? null) as Verdict | null;
  return effectiveVerdict(override, auto) === 'OK' ? 'ok' : 'nok';
}

/** Map a stored day to its recap row. A logged day carries kcal + state (and macros on a detailed
 *  day); a day with no calorie value (a comment-only / cleared "red" day) reads as not-logged
 *  (`none`, kcal/macros null) but keeps its comment. */
function toIntervalDay(aggregate: DayAggregate): IntervalDay {
  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const totals = isSummary ? null : computeDayTotals(aggregate);
  const kcal = isSummary ? num(dayLog.summaryKcal ?? 0) : (totals?.kcal ?? 0);
  const logged = isSummary ? dayLog.summaryKcal !== null : kcal > 0;
  return {
    date: isoOf(aggregate),
    kcal: logged ? kcal : null,
    macros: logged && totals ? { L: totals.fat, G: totals.carb, P: totals.protein } : null,
    comment: dayLog.comment,
    state: logged ? loggedState(aggregate, isSummary, kcal) : 'none',
  };
}

/** The interval's recap figures: calendar-day count, logged-day count, and the mean kcal over the
 *  logged days (server-computed — renders ≠ computes), null when no day was logged. */
function buildSummary(days: IntervalDay[]): IntervalDaysSummary {
  const logged = days.filter((d) => d.kcal !== null);
  const total = logged.reduce((sum, d) => sum + (d.kcal ?? 0), 0);
  return {
    day_count: days.length,
    logged_count: logged.length,
    avg_kcal: logged.length ? Math.round(total / logged.length) : null,
  };
}

/** Every calendar day of `[start,end]` inclusive, oldest first, plus the interval summary (B-225,
 *  B-227). Days with no `day_log` row are filled as not-logged (`none`). User-scoped via `readRange`
 *  (cross-tenant days never leak → an interval with no data is all-`none`, `avg_kcal: null`). */
export async function intervalDays(
  userId: string,
  start: string,
  end: string,
): Promise<IntervalDaysResponse> {
  const aggregates = await dayReadRepo.readRange(userId, start, end);
  const byDate = new Map(aggregates.map((a) => [isoOf(a), a]));
  const data = eachDate(start, end).map((date): IntervalDay => {
    const agg = byDate.get(date);
    return agg
      ? toIntervalDay(agg)
      : { date, kcal: null, macros: null, comment: null, state: 'none' };
  });
  return { data, summary: buildSummary(data) };
}
