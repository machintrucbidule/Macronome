// Shared configuration for the M9d perf-check script (docs/dev-plan/M9-polish.md §M9d).
// Synthetic-only: no personal data, safe to commit. The script seeds a throwaway user
// with a large dataset, measures Stats + Foods search, EXPLAINs the hot queries, and
// verifies the contract indexes (spec/schema/indexes.md). Run on demand, NOT in CI.

/** Username of the disposable account the perf run seeds and then deletes. */
export const PERF_USERNAME = '__perf_seed__';

/** Dataset sizes — a few years of daily logs + a large food catalog. Override the
 * year span with the first CLI arg (e.g. `npm run perf:check -- 8`). */
export const SIZES = {
  foods: 5000,
  years: 5,
  mealsPerDay: 4,
  entriesPerMeal: 3,
  /** Insert batch size for createMany. */
  chunk: 1000,
} as const;

/** A small accented vocabulary so trigram search has realistic, diacritic-bearing hits. */
export const FOOD_WORDS = [
  'café',
  'crème',
  'œuf',
  'poêlée',
  'pâtes',
  'thé',
  'rôti',
  'purée',
  'épinard',
  'gâteau',
] as const;

/** Search terms exercised by the measurement pass (already accent-folded, as the
 * service normalises the query before hitting the trigram index). '' = full browse. */
export const SEARCH_TERMS = ['creme', 'cafe', 'oeuf', 'gateau', ''] as const;

/** How many times each measured call is repeated (min/median/max are reported). */
export const REPEATS = 7;

/** Soft budgets (ms): exceeding one prints a warning but never fails the run. */
export const BUDGETS = { search: 300, stats: 1500 } as const;

/** Contract indexes whose presence the run asserts (spec/schema/indexes.md). Matched on
 * pg_indexes.indexdef by table + the columns it must cover (+ gin for trigram), so the
 * historical `idx_day_log_owner_date` naming deviation does not register as a miss. */
export const INDEX_CHECKS: { table: string; columns: string[]; gin?: boolean; label: string }[] = [
  { table: 'food', columns: ['normalized_name'], gin: true, label: 'food trigram search' },
  { table: 'recipe', columns: ['normalized_name'], gin: true, label: 'recipe trigram search' },
  {
    table: 'container',
    columns: ['normalized_name'],
    gin: true,
    label: 'container trigram search',
  },
  { table: 'food', columns: ['owner_id'], label: 'food owner scope' },
  { table: 'food', columns: ['owner_id', 'normalized_name'], label: 'food name resolution' },
  { table: 'recipe', columns: ['owner_id'], label: 'recipe owner scope' },
  { table: 'container', columns: ['owner_id'], label: 'container owner scope' },
  { table: 'day_log', columns: ['user_id', 'date'], label: 'day traversal (stats)' },
  { table: 'meal', columns: ['day_log_id', 'order_index'], label: 'meal traversal' },
  { table: 'meal_entry', columns: ['meal_id', 'order_index'], label: 'entry traversal' },
  { table: 'leftover_group', columns: ['meal_id'], label: 'leftover traversal' },
  { table: 'weight_entry', columns: ['user_id', 'date'], label: 'weight traversal' },
  { table: 'target', columns: ['user_id', 'effective_from'], label: 'target lookup' },
  { table: 'pantry_item', columns: ['user_id', 'meal_slot_name'], label: 'pantry lookup' },
];
