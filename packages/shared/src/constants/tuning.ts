// Tuning constants — single source of truth for the small, deliberately-tunable
// magic numbers of the metabolic/targets engine. No calculation lives here.
// Source: spec/logic/targets-macros.md §5, spec/logic/metabolic-engine.md §3,
// spec/logic/stats-adherence.md §6–7, spec/logic/meal-solver.md + ai-meal-suggestions.md (B-123).

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

// --- AI meal-solver (spec/logic/meal-solver.md, B-123) --------------------
// Weights/limits for the pure deterministic solver that sets meal-proposal quantities. The fit
// guarantee is computed in code; these numbers are owner-tunable and backed by the §6 oracles.

/** Penalty weights for the solver's objective `P(q)` (meal-solver.md §2). The asymmetry encodes
 * the hard/soft split (D2) and the conservative bias (D3): calorie-over costs more than
 * calorie-under; floor shortfalls are weighted high; the carb ceiling is soft; a tiny carb term
 * breaks ties toward the lower-carb remainder without ever blocking feasibility. */
export const SOLVER_PENALTY = {
  CAL_OVER: 1.5, // per kcal over cal_max (> CAL_UNDER, D3)
  CAL_UNDER: 1.0, // per kcal under cal_min
  PROTEIN_FLOOR: 8, // per g protein-floor shortfall (hard)
  FAT_FLOOR: 8, // per g fat-floor shortfall (hard)
  CARB_CEILING: 0.5, // per g over carb ceiling (soft)
  CARB_TIEBREAK: 0.05, // per g carb — deterministic tie-break
} as const;

/** Quantisation step (g) for portionless foods — the solver moves grams in 5 g increments. */
export const PORTIONLESS_GRAM_STEP = 5;

/** Max whole portions a single portioned food may contribute to one proposal (indivisible). */
export const MAX_PORTION_COUNT = 6;

/** Number of distinct proposals returned per call. */
export const MEAL_SUGGESTION_COUNT = 3;

/** Look-back window (OK days) sampled from history to seed preferences/combinations + variety. */
export const OK_DAY_HISTORY_WINDOW_DAYS = 60;

/** Cap on the candidate food pool sent to the LLM (token budget); the cap is logged, never hidden. */
export const MAX_CANDIDATE_FOODS = 120;

/** Combination ceiling for exhaustive enumeration; above it the solver falls back to coordinate
 * descent from a proportional-scaling seed. */
export const SOLVER_ENUM_BUDGET = 200_000;
