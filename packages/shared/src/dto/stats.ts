import { z } from 'zod';

// Stats DTOs (spec/api/weight-targets-stats-settings.md §Stats,
// spec/logic/stats-adherence.md). Read-only analytics: requests carry at most a year;
// responses are plain interfaces the server derives and the web only renders (the web
// never recomputes a figure — CLAUDE.md rule 2). Field names stay snake_case to match
// the API contract. SI units (kcal).

// --- Request schema --------------------------------------------------------

/** GET /stats/adherence?year=YYYY — scopes the heatmap, monthly pivots and per-year key. */
export const StatsAdherenceQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(9999),
});
export type StatsAdherenceQuery = z.infer<typeof StatsAdherenceQuerySchema>;

// --- Rolling (GET /stats/rolling) ------------------------------------------

/** Where a window's average sits relative to the current calorie band. */
export type VsTarget = 'in' | 'above' | 'below';

/** One rolling window over the last N calendar days, as of the latest logged day.
 * Figures are null when the window holds no logged day. */
export interface RollingWindow {
  window: number;
  avg_kcal: number | null;
  ok_rate: number | null;
  vs_target: VsTarget | null;
}

export interface RollingResponse {
  /** The latest logged day the windows are computed against (null = no logged day). */
  as_of: string | null;
  windows: RollingWindow[];
}

// --- Adherence (GET /stats/adherence?year=YYYY) ----------------------------

/** One calendar cell of the selected year. `none` = not logged (grey, never NOK).
 * `kcal` = that day's calorie value for logged cells, `null` when `status:'none'`. */
export interface HeatmapCell {
  date: string;
  status: 'OK' | 'NOK' | 'none';
  kcal: number | null;
}

/** Per-month pivot over the selected year's logged days (only months with data).
 * Carries both the OK/NOK counts and the avg-kcal split (one array for both charts). */
export interface MonthlyStat {
  month: number; // 1–12
  ok_count: number;
  nok_count: number;
  ok_rate: number;
  avg_kcal_ok: number | null;
  avg_kcal_nok: number | null;
}

/** Best month = highest ok_rate among months with ≥ BEST_MONTH_MIN_DAYS logged days. */
export interface BestMonth {
  month: string; // YYYY-MM
  ok_rate: number;
  logged_days: number;
}

export interface KeyFigures {
  year_ok_rate: number | null;
  overall_ok_rate: number | null;
  current_ok_streak: number;
  best_month: BestMonth | null;
}

/** The current calorie band the charts shade and compare against (null = no target). */
export interface TargetZone {
  cal_min: number;
  cal_max: number;
}

/** A factual, rule-based signal. `text` is the contract's English fallback; the web
 * localizes via `stats.signal.<code>` with `value` interpolation (no motivational copy).
 * `status` is server-decided and drives the design's status dot (rule 2: the web never
 * derives a verdict — see spec/logic/stats-adherence.md §7). */
export interface Signal {
  code: string;
  value: number;
  text: string;
  status: 'ok' | 'warn' | 'info';
}

export interface AdherenceResponse {
  heatmap: HeatmapCell[];
  monthly: MonthlyStat[];
  key: KeyFigures;
  target_zone: TargetZone | null;
  signals: Signal[];
}
