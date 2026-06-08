import { ACTIVITY_LEVELS, ACTIVITY_MULTIPLIERS, type ActivityLevel } from '@macronome/shared';

// Pure presentation helpers for the Poids Period table (WV-1 / B-115). The web only
// derives a colour/arrow class from values already on the Period DTO; it computes no
// nutrition figure (CLAUDE.md rule 2). See design/components/data-tables.md.

/** Trend tone for a signed figure where the **lower** value is "good": weight ↓, below
 * trajectory (negative écart), a calorie deficit (negative deficit/day). `null` at 0. */
export type Tone = 'pos' | 'neg' | null;
export const signTone = (n: number): Tone => (n < 0 ? 'pos' : n > 0 ? 'neg' : null);

/** Direction arrow for the Δ cell: ▼ losing, ▲ gaining, none at 0. */
export type Arrow = '▼' | '▲' | null;
export const deltaArrow = (n: number): Arrow => (n < 0 ? '▼' : n > 0 ? '▲' : null);

/** Bucket an average PAL multiplier (×1.2–1.9) to the nearest canonical activity level,
 * so the cell can be tinted with the B-085/B-101 level palette. */
export function activityLevelFromMultiplier(m: number): ActivityLevel {
  let best: ActivityLevel = ACTIVITY_LEVELS[0];
  let bestDist = Infinity;
  for (const level of ACTIVITY_LEVELS) {
    const dist = Math.abs(ACTIVITY_MULTIPLIERS[level] - m);
    if (dist < bestDist) {
      bestDist = dist;
      best = level;
    }
  }
  return best;
}
