import { z } from 'zod';

// Day compliance-tone DTOs (spec/api/days-meals-leftover.md · logic/day-snapshot-verdict.md §8b).
// Kept out of `day.ts` only because that file is at its 300-line ceiling; conceptually it belongs
// beside DayState — which it is deliberately NOT: state is data-presence, tone is compliance.

/** A day's compliance tone (spec/logic/day-snapshot-verdict.md §8b): none (no calorie value) ·
 *  ok (on target) · warn (off target but still under the estimated burn) · nok (off target and
 *  over it, or the burn is unknown). Derived server-side; the web only renders it (rule 2). */
export const DayToneSchema = z.enum(['none', 'ok', 'warn', 'nok']);
export type DayTone = z.infer<typeof DayToneSchema>;

/** GET /days/:date/tone — the strictly read-only colour probe polled by the app frame. */
export interface DayToneResponse {
  date: string;
  tone: DayTone;
}
