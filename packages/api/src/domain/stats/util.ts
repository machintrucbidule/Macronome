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
