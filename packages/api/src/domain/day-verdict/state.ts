// Day state derivation (spec/logic/day-snapshot-verdict.md §8). Pure: no DB, no request.
// The web never derives a state (CLAUDE.md rule 2) — the server stamps it on each day sheet
// and Journal row. State is calorie-driven: a day "counts" only when it carries a calorie
// value (detailed Σ > 0, or a summary total) and its date has arrived.

/** A day's calorie-driven state (spec/logic/day-snapshot-verdict.md §8). */
export type DayState = 'none' | 'green' | 'yellow' | 'red';

export interface DayStateInputs {
  /** Persisted day kind, or null when no day_log row exists for the date. */
  kind: 'detailed' | 'summary' | null;
  /** Calorie value: detailed Σ consumed kcal, or summary summary_kcal; 0 when absent. */
  dayKcal: number;
  /** date > today (a planned/future day). */
  isFuture: boolean;
}

/** Derive the day state from its calorie value and its date vs today (§8). Precedence:
 *  summary → yellow; detailed with Σ > 0 → green; otherwise red (date ≤ today) / none (future). */
export function dayState({ kind, dayKcal, isFuture }: DayStateInputs): DayState {
  if (kind === 'summary') return 'yellow';
  if (kind === 'detailed' && dayKcal > 0) return 'green';
  // No calorie value: no row, or a detailed day with Σ = 0 (cleared / pantry-only at qty 0).
  return isFuture ? 'none' : 'red';
}

/** Logged day = the stats unit: a calorie-bearing day whose date has arrived (§8).
 *  Equivalent to "(green | yellow) AND date ≤ today"; none/red are never logged. */
export function isLoggedDay(inputs: DayStateInputs): boolean {
  const s = dayState(inputs);
  return (s === 'green' || s === 'yellow') && !inputs.isFuture;
}
