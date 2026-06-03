// Food rating scale — single source of truth, imported by `api` (filter logic)
// and `web` (labels/rendering). No calculation lives here.
// Source: spec/logic/00-conventions.md §"Rating scale", DECISIONS.md Gap #7.
//
// null = unrated (default, rendered as an em-dash "—", no star widget) ·
// 0 = Bof · 1 = Moyen · 2 = Ok · 3 = Top.
// 0 is a real grade, distinct from unrated.

/** A stored rating: null = unrated, otherwise a 0..3 grade. */
export type Rating = 0 | 1 | 2 | 3 | null;

/** The valid non-null grades, low → high. */
export const RATING_GRADES = [0, 1, 2, 3] as const;

/** i18n key suffixes for each grade (UI resolves to FR/EN strings). */
export const RATING_LABEL_KEYS = {
  0: 'rating.bof',
  1: 'rating.moyen',
  2: 'rating.ok',
  3: 'rating.top',
} as const;

/** Rendered when a food is unrated (null). */
export const UNRATED_DISPLAY = '—';

/**
 * "Minimum rating" filter semantics (Aliments). A `min` of 1|2|3 keeps only foods
 * whose rating is a real grade ≥ min; unrated (null) is treated as below 1, so
 * `min >= 1` excludes BOTH Bof (0) and unrated.
 */
export function passesMinRating(rating: Rating, min: 1 | 2 | 3): boolean {
  return rating !== null && rating >= min;
}
