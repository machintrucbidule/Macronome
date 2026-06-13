import type { VsTarget } from '@macronome/shared';

// Shared types + tiny pure helpers for the stats domain (spec/logic/stats-adherence.md).
// A `DayStat` is one ALREADY-LOGGED day with its effective verdict resolved upstream;
// not-logged days never reach the domain (they are excluded from every figure, grey on
// the heatmap — §1). No DB, no I/O. Full precision: rounding happens at render (web).

export interface DayStat {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  /** day_kcal (Σ entries or summary_kcal). */
  kcal: number;
  /** Effective verdict (override ?? auto). */
  verdict: 'OK' | 'NOK';
  /** The day's FROZEN calorie band (target_snapshot), or null when it had no real target.
   * Used to judge a rolling average against the bands that actually applied (B-100). */
  band: { cal_min: number; cal_max: number } | null;
  /** The day's `day_kcal − estimated_burn` (per-day BMR × activity_level), or null when the burn
   * can't be computed (no weigh-in/profile). Splits a NOK day into deficit/surplus for the heatmap
   * + monthly bars (B-167). Set only on the adherence path; null (unused) on the rolling path. */
  burnGap: number | null;
}

/** A NOK day's sub-tone (B-167): orange `NOK_under` when still in a real deficit
 * (`burnGap ≤ 0`), else red `NOK_over` (surplus, or burn unknown → null). */
export function nokSubStatus(s: DayStat): 'NOK_under' | 'NOK_over' {
  return s.burnGap !== null && s.burnGap <= 0 ? 'NOK_under' : 'NOK_over';
}

/** Heatmap cell status of a logged day (B-167): OK green, else the NOK deficit/surplus split. */
export function heatStatus(s: DayStat): 'OK' | 'NOK_under' | 'NOK_over' {
  return s.verdict === 'OK' ? 'OK' : nokSubStatus(s);
}

/** Arithmetic mean, or null for an empty set. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** OK rate over a set of logged days = OK / count, or null when empty. */
export function okRate(stats: DayStat[]): number | null {
  if (stats.length === 0) return null;
  return stats.filter((s) => s.verdict === 'OK').length / stats.length;
}

/** Mean of the per-day frozen bands over the days that carried a real one (cal_max > 0), or
 * null when none did. Lets a window's average be judged against the bands that actually
 * applied, not today's band (B-100; robust to target changes over the window, cf. B-099). */
export function meanBand(stats: DayStat[]): { cal_min: number; cal_max: number } | null {
  const bands = stats
    .map((s) => s.band)
    .filter((b): b is { cal_min: number; cal_max: number } => b !== null && b.cal_max > 0);
  if (bands.length === 0) return null;
  return {
    cal_min: mean(bands.map((b) => b.cal_min))!,
    cal_max: mean(bands.map((b) => b.cal_max))!,
  };
}

/** Where an average sits relative to the band; null when either input is missing. */
export function vsTarget(
  avg: number | null,
  zone: { cal_min: number; cal_max: number } | null,
): VsTarget | null {
  if (avg === null || zone === null) return null;
  if (avg < zone.cal_min) return 'below';
  if (avg > zone.cal_max) return 'above';
  return 'in';
}

/** Shift a YYYY-MM-DD date by n calendar days (UTC), returning YYYY-MM-DD. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The latest (max) date among logged days, or null when there are none. */
export function latestDate(logged: DayStat[]): string | null {
  let max: string | null = null;
  for (const s of logged) if (max === null || s.date > max) max = s.date;
  return max;
}
