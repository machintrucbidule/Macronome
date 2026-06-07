import type { JournalResponse, JournalRow, Verdict } from '@macronome/shared';
import type { DayAggregate } from '../data/repositories/day-read.repo.js';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import {
  autoVerdict,
  dayState,
  effectiveVerdict,
  type ResolvedSnapshot,
} from '../domain/day-verdict/index.js';
import { computeDayTotals } from './day-assembler.js';
import { isFuture } from './day-context.js';

// Journal service (spec/api/days-meals-leftover.md §Journal). A read-only history view:
// one row per logged day of a year, newest first. Verdicts use each day's STORED snapshot
// (a frozen history; later target/weight edits never move a past row). Macros are null for
// summary days. Row click resolves to GET /days/:date (the full sheet).

const num = (d: { toString(): string }): number => Number(d.toString());

function toRow(aggregate: DayAggregate): JournalRow {
  const { dayLog } = aggregate;
  const snapshot = dayLog.targetSnapshot as unknown as ResolvedSnapshot;
  const isSummary = dayLog.kind === 'summary';
  const totals = isSummary ? null : computeDayTotals(aggregate);
  const kcal = isSummary ? num(dayLog.summaryKcal ?? 0) : totals!.kcal;
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const override = (dayLog.verdictOverride ?? null) as Verdict | null;
  const date = dayLog.date.toISOString().slice(0, 10);
  const kind = dayLog.kind as 'detailed' | 'summary';
  const state = dayState({ kind, dayKcal: kcal, isFuture: isFuture(date) });
  // The Calories cell is inline-editable on any day with no real detail (not green) — typing
  // a total creates/updates a summary day (no provenance distinction; see logic §9).
  const editableKcal = state !== 'green';
  return {
    date,
    kcal,
    macros: totals ? { L: totals.fat, G: totals.carb, P: totals.protein } : null,
    verdict_auto: auto,
    verdict_override: override,
    effective_verdict: effectiveVerdict(override, auto),
    activity_level: dayLog.activityLevel,
    comment: dayLog.comment,
    kind,
    state,
    editable_kcal: editableKcal,
  };
}

/** GET /journal?year=YYYY — one row per logged day, newest first. The global
 *  min/max year (across all years) bounds the year selector (B-067). */
export async function listByYear(userId: string, year: number): Promise<JournalResponse> {
  const [aggregates, range] = await Promise.all([
    dayReadRepo.readYear(userId, year),
    dayReadRepo.yearRange(userId),
  ]);
  const data = aggregates.map(toRow);
  return { data, day_count: data.length, min_year: range.minYear, max_year: range.maxYear };
}
