// Day COMPLIANCE tone (spec/logic/day-snapshot-verdict.md §8b). Pure: no DB, no request.
// Distinct from `dayState` next door despite the overlapping colour words: state answers "does
// this day carry a calorie value?" (a data-presence ladder), tone answers "is this day on
// target?". Every surface that colours a verdict — the day badge, the Journal pill, the
// window-level rule — reads this one value, so they cannot disagree (CLAUDE.md rule 2).

import type { Verdict } from './verdict.js';

/** A day's compliance tone (spec/logic/day-snapshot-verdict.md §8b). */
export type DayTone = 'none' | 'ok' | 'warn' | 'nok';

export interface DayToneInputs {
  /** Manual override if set, else the auto verdict (§6). Null when there is nothing to judge. */
  effective: Verdict | null;
  /** The day carries a calorie value: detailed Σ > 0, or a summary total. Same test as §8. */
  hasCalorieValue: boolean;
  /** Signed burn gap (`constat.deficit`): ≤ 0 = intake at/under the estimated burn.
   *  Null when the day has no body weight yet — an unknown burn is not evidence of a deficit. */
  burnGap: number | null;
}

/** Derive the tone (§8b). Precedence: no calorie value → `none`; OK → `ok`; NOK still under the
 *  burn → `warn`; otherwise `nok`. Unlike the state, this never branches on the date. */
export function dayTone({ effective, hasCalorieValue, burnGap }: DayToneInputs): DayTone {
  if (!hasCalorieValue) return 'none';
  if (effective === 'OK') return 'ok';
  return burnGap !== null && burnGap <= 0 ? 'warn' : 'nok';
}
