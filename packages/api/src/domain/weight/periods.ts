import type { DietFlag } from '@macronome/shared';

// Period derivation (spec/logic/weight-periods-trajectory.md §1). A period is the span
// between two consecutive weigh-ins, ordered by date. days = date(next) − date(prev) ≥ 1.
// One weigh-in per day guarantees no zero-day periods. Single/empty series → no periods.
// Per-period intake/burn stats are layered on top in the service (they need day_log).

const MS_PER_DAY = 86_400_000;

export interface WeighInInput {
  /** ISO date YYYY-MM-DD. */
  date: string;
  weightKg: number;
  waistCm: number | null;
  /** Describes the period ENDING at this weigh-in. */
  dietFlag: DietFlag;
  note: string | null;
}

export interface RawPeriod {
  startDate: string;
  endDate: string;
  days: number;
  weightStart: number;
  weightEnd: number;
  /** Waist at the period's end weigh-in (null when not recorded). */
  waist: number | null;
  /** Flag of the period (taken from its ending weigh-in). */
  dietFlag: DietFlag;
  note: string | null;
}

/** Whole-day span between two ISO dates (end − start). */
function spanDays(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / MS_PER_DAY);
}

/** Sort ascending by date, then one period per consecutive weigh-in pair. */
export function derivePeriods(entries: WeighInInput[]): RawPeriod[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const periods: RawPeriod[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    periods.push({
      startDate: prev.date,
      endDate: cur.date,
      days: spanDays(prev.date, cur.date),
      weightStart: prev.weightKg,
      weightEnd: cur.weightKg,
      waist: cur.waistCm,
      dietFlag: cur.dietFlag,
      note: cur.note,
    });
  }
  return periods;
}
