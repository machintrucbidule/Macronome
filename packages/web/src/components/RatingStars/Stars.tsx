import type { Rating } from '@macronome/shared';
import { UNRATED_DISPLAY } from '@macronome/shared';
import { StarGlyphs } from './StarGlyphs';
import styles from './RatingStars.module.css';

// Read-only rating (design/components/rating-stars.md). Unrated (null) renders as a
// bare em-dash with NO star widget; 0/Bof renders three empty stars — visually
// distinct, per DECISIONS.md Gap #7.
export function Stars({ rating }: { rating: Rating }) {
  if (rating === null) return <span className={styles.unrated}>{UNRATED_DISPLAY}</span>;
  return <StarGlyphs grade={rating} ariaLabel={`${rating}/3`} />;
}
