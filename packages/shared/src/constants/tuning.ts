// Tuning constants — single source of truth for the small, deliberately-tunable
// magic numbers of the metabolic/targets engine. No calculation lives here.
// Source: spec/logic/targets-macros.md §5, spec/logic/metabolic-engine.md §3.

/** Default half-width (kcal) of the calorie range proposed by "suggest a target". */
export const SUGGEST_RANGE_HALF_WIDTH_KCAL = 50;

/** Look-back window (calendar days) for the recent-average activity used on Cibles. */
export const RECENT_ACTIVITY_WINDOW_DAYS = 30;

/** Smoothing factor for the weight EMA trend (DECISIONS Gap #9; tune post-load). */
export const EMA_ALPHA = 0.35;
