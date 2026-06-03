import type { Rating } from '@macronome/shared';
import { RATING_GRADES, UNRATED_DISPLAY } from '@macronome/shared';
import styles from './RatingStars.module.css';

// Read-only rating (design/components/rating-stars.md). Unrated (null) renders as a
// bare em-dash with NO star widget; 0/Bof renders three empty stars — visually
// distinct, per DECISIONS.md Gap #7.
export function Stars({ rating }: { rating: Rating }) {
  if (rating === null) return <span className={styles.unrated}>{UNRATED_DISPLAY}</span>;
  return (
    <span className={styles.stars} aria-label={`${rating}/3`}>
      {RATING_GRADES.filter((g) => g >= 1).map((g) => (
        <span key={g} className={`${styles.s} ${g <= rating ? styles.on : ''}`}>
          ★
        </span>
      ))}
    </span>
  );
}
