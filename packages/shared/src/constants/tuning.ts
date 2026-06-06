// Tuning constants — single source of truth for the small, deliberately-tunable
// magic numbers of the metabolic/targets engine. No calculation lives here.
// Source: spec/logic/targets-macros.md §5, spec/logic/metabolic-engine.md §3,
// spec/logic/stats-adherence.md §6–7.

/** Default half-width (kcal) of the calorie range proposed by "suggest a target". */
export const SUGGEST_RANGE_HALF_WIDTH_KCAL = 50;

/** Look-back window (calendar days) for the recent-average activity used on Cibles. */
export const RECENT_ACTIVITY_WINDOW_DAYS = 30;

/** Smoothing factor for the weight EMA trend (DECISIONS Gap #9; tune post-load). */
export const EMA_ALPHA = 0.35;

/** Stats rolling-average windows in calendar days (stats-adherence.md §2). */
export const STATS_ROLLING_WINDOWS = [7, 14, 30, 365] as const;

/** Min logged days a month needs to be eligible for "best month" (stats §6). */
export const BEST_MONTH_MIN_DAYS = 5;

/** Surface the current-NOK-run signal once it reaches this length (stats §7). */
export const NOK_RUN_ALERT = 3;

/** 14-day OK-rate "good" threshold (percent): at/above → ok dot, below → warn (stats §7). */
export const OK_RATE_GOOD_PCT = 70;
