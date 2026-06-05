import type { DayAggregate } from '../data/repositories/day-read.repo.js';
import {
  autoVerdict,
  effectiveVerdict,
  type ResolvedSnapshot,
} from '../domain/day-verdict/index.js';
import type { Verdict } from '../domain/day-verdict/index.js';
import type { DayStat } from '../domain/stats/index.js';
import { computeDayTotals } from './day-assembler.js';

// Maps a day aggregate to the lightweight DayStat the stats domain consumes, or null when
// the day is NOT logged (spec/logic/stats-adherence.md §1): a summary day without
// summary_kcal, or a detailed day with no entries (comment/activity-only) carries no
// calorie value and is excluded everywhere. Verdicts use the STORED snapshot (frozen
// history — the journal pattern), so later target/weight edits never move a past figure.

const num = (d: { toString(): string }): number => Number(d.toString());

/** Whether a detailed day has at least one logged entry across its meals. */
function hasEntries(aggregate: DayAggregate): boolean {
  return aggregate.meals.some((m) => m.entries.length > 0);
}

/** DayStat for a logged day, or null when the day carries no calorie value. */
export function dayStat(aggregate: DayAggregate): DayStat | null {
  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const logged = isSummary ? dayLog.summaryKcal !== null : hasEntries(aggregate);
  if (!logged) return null;

  const snapshot = dayLog.targetSnapshot as unknown as ResolvedSnapshot;
  const kcal = isSummary ? num(dayLog.summaryKcal!) : computeDayTotals(aggregate).kcal;
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const override = (dayLog.verdictOverride ?? null) as Verdict | null;
  return {
    date: dayLog.date.toISOString().slice(0, 10),
    kcal,
    verdict: effectiveVerdict(override, auto) as Verdict,
  };
}

/** Map a list of aggregates to DayStat, dropping not-logged days. */
export function toDayStats(aggregates: DayAggregate[]): DayStat[] {
  return aggregates.map(dayStat).filter((s): s is DayStat => s !== null);
}
