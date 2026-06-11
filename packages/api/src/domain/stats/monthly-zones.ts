import type { TargetZone } from '@macronome/shared';

// Per-month calorie band resolution (spec/logic/stats-adherence.md §5, CZ-1/B-141). The
// avg-kcal chart shades each month with the band of the target effective that month, so
// the band steps across target changes — the same per-period pattern as the weight
// trajectory rate (B-099, domain/weight/trajectory.ts rateAsOf). Pure, no I/O.

/** One target version, reduced to its effective date + calorie band. */
export interface TargetBand {
  effectiveFrom: string; // YYYY-MM-DD
  cal_min: number;
  cal_max: number;
}

/**
 * The calorie band effective as of `date`: the latest `effectiveFrom ≤ date`. When `date`
 * precedes every target the **earliest** band applies (retroactive — mirrors
 * targetRepo.currentAsOf / B-090). Null only when there is no target at all.
 */
export function zoneAsOf(targets: TargetBand[], date: string): TargetZone | null {
  if (targets.length === 0) return null;
  const sorted = [...targets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let band = sorted[0]!; // earliest as the retroactive fallback
  for (const t of sorted) {
    if (t.effectiveFrom <= date) band = t;
    else break;
  }
  return { cal_min: band.cal_min, cal_max: band.cal_max };
}

/** The last calendar day of `month` in `year`, as `YYYY-MM-DD` (day 0 of the next month). */
export function monthEndDate(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
