import type { JournalResponse, JournalRow, Verdict } from '@macronome/shared';
import { DEFAULT_ACTIVITY_LEVEL } from '@macronome/shared';
import type { DayAggregate } from '../data/repositories/day-read.repo.js';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import {
  autoVerdict,
  dayState,
  effectiveVerdict,
  type ResolvedSnapshot,
} from '../domain/day-verdict/index.js';
import { computeDayTotals } from './day-assembler.js';
import { isFuture, todayString } from './day-context.js';

// Journal service (spec/api/days-meals-leftover.md §Journal). The history view returns the
// full calendar TRAME (day-model): one row per calendar day from max(first record, Jan 1) to
// today — empty days flagged `red` — PLUS any future day that already has a row (listed inline,
// author decision). Verdicts use each day's STORED snapshot (frozen history). `day_count` stays
// the number of LOGGED days (calorie-bearing, date ≤ today), distinct from the rendered rows.

const num = (d: { toString(): string }): number => Number(d.toString());

const isoOf = (aggregate: DayAggregate): string => aggregate.dayLog.date.toISOString().slice(0, 10);

/** Map a stored day to its Journal row (state + editable_kcal derived server-side, §8). */
function toRow(aggregate: DayAggregate): JournalRow {
  const { dayLog } = aggregate;
  const snapshot = dayLog.targetSnapshot as unknown as ResolvedSnapshot;
  const isSummary = dayLog.kind === 'summary';
  const totals = isSummary ? null : computeDayTotals(aggregate);
  const kcal = isSummary ? num(dayLog.summaryKcal ?? 0) : totals!.kcal;
  const auto = autoVerdict(kcal, snapshot.cal_min, snapshot.cal_max);
  const override = (dayLog.verdictOverride ?? null) as Verdict | null;
  const date = isoOf(aggregate);
  const kind = dayLog.kind as 'detailed' | 'summary';
  const state = dayState({ kind, dayKcal: kcal, isFuture: isFuture(date) });
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
    // Calories cell is inline-editable on any non-green day (typing a total → summary day).
    editable_kcal: state !== 'green',
  };
}

/** A never-touched calendar day in the trame: a red, empty (not logged) row (§8). The trame
 *  only spans dates ≤ today, so an empty trame day is always `red` (never future `none`). */
function emptyRow(date: string): JournalRow {
  return {
    date,
    kcal: 0,
    macros: null,
    verdict_auto: null,
    verdict_override: null,
    effective_verdict: null,
    activity_level: DEFAULT_ACTIVITY_LEVEL,
    comment: null,
    kind: null,
    state: 'red',
    editable_kcal: true,
  };
}

/** Calendar dates from `start` to `end` inclusive (YYYY-MM-DD), oldest first. */
function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const isLogged = (r: JournalRow, today: string): boolean =>
  (r.state === 'green' || r.state === 'yellow') && r.date <= today;

/** GET /journal?year=YYYY — the full calendar trame for the year, newest first (day-model). */
export async function listByYear(userId: string, year: number): Promise<JournalResponse> {
  const [aggregates, range] = await Promise.all([
    dayReadRepo.readYear(userId, year),
    dayReadRepo.yearRange(userId),
  ]);
  const byDate = new Map(aggregates.map((a) => [isoOf(a), a]));
  const today = todayString();
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  // Trame: max(first record, Jan 1) → min(today, Dec 31). Empty days are red.
  const start = range.minDate && range.minDate > jan1 ? range.minDate : jan1;
  const end = today < dec31 ? today : dec31;

  const rows: JournalRow[] = [];
  // No trame before the user's first record ever (a brand-new account shows the empty state,
  // not a wall of red days). Future planned rows below are still listed when present.
  if (range.minDate !== null && start <= end) {
    for (const date of eachDate(start, end)) {
      const agg = byDate.get(date);
      rows.push(agg ? toRow(agg) : emptyRow(date));
    }
  }
  // Future days (> today, within the year) that already carry data — listed inline, never
  // generated as empties (author decision; they stay excluded from stats until their date).
  for (const agg of aggregates) {
    const date = isoOf(agg);
    if (date > today && date <= dec31) rows.push(toRow(agg));
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first

  const day_count = rows.filter((r) => isLogged(r, today)).length;
  return { data: rows, day_count, min_year: range.minYear, max_year: range.maxYear };
}

/** Every stored day mapped to its Journal row, oldest first — the per-day CSV export (EX-1 /
 *  B-132). Reuses `toRow` so the export can never drift from the screen; no calendar trame here
 *  (only real day_log rows), so each row is an actually-logged day. */
export async function listAllLogged(userId: string): Promise<JournalRow[]> {
  const aggregates = await dayReadRepo.readAll(userId);
  return aggregates.map(toRow);
}
