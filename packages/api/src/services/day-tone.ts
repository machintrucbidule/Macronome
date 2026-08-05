import type { DayToneResponse } from '@macronome/shared';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import {
  autoVerdict,
  dayTone,
  effectiveVerdict,
  type ResolvedSnapshot,
  type Verdict,
} from '../domain/day-verdict/index.js';
import { buildConstat, computeDayTotals } from './day-assembler.js';
import { isPast, loadDayContext, resolveSnapshotForDate } from './day-context.js';

// Day compliance-tone service (spec/api/days-meals-leftover.md · logic/day-snapshot-verdict.md
// §8b, B-262). Its whole reason to exist is that `days.get()` is NOT a pure read: it re-persists
// the live target snapshot and verdict_auto on every read of a non-past date. The app frame polls
// the tone on focus/interval, so this path must never write — and must stay cheap: no meal
// assembly, no leftover payload, no pantry lookup. Same rule as the `tone` field of DayDetail /
// JournalRow, single-sourced through the pure `dayTone()`.

/** GET /days/:date/tone — read-only. A never-touched date is `none`; nothing is created. */
export async function get(userId: string, date: string): Promise<DayToneResponse> {
  const aggregate = await dayReadRepo.readAggregate(userId, date);
  if (!aggregate) return { date, tone: 'none' };

  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const kcal = isSummary
    ? Number((dayLog.summaryKcal ?? 0).toString())
    : computeDayTotals(aggregate).kcal;

  // A day with no calorie value is `none` whatever the verdict says, so skip the snapshot and
  // constat work entirely — that is the common case for the polled frame (an empty today).
  const hasCalorieValue = isSummary || kcal > 0;
  if (!hasCalorieValue) return { date, tone: 'none' };

  const [ctx, snapshot] = await Promise.all([
    loadDayContext(userId, date),
    isPast(date)
      ? Promise.resolve(dayLog.targetSnapshot as unknown as ResolvedSnapshot)
      : resolveSnapshotForDate(userId, date),
  ]);
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const effective = effectiveVerdict((dayLog.verdictOverride ?? null) as Verdict | null, auto);
  const constat = buildConstat({ ...ctx, activityLevel: dayLog.activityLevel, dayKcal: kcal });
  return { date, tone: dayTone({ effective, hasCalorieValue, burnGap: constat.deficit }) };
}
