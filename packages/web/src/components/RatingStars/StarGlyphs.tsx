import { RATING_GRADES } from '@macronome/shared';
import styles from './RatingStars.module.css';

// Three star glyphs with `grade` of them filled (yellow), the rest empty (grey).
// Shared by the read-only Stars cell and the RatingSelect option/trigger labels
// (design/components/rating-stars.md). grade 0 → three empty stars (= Bof).
export function StarGlyphs({ grade, ariaLabel }: { grade: number; ariaLabel?: string }) {
  return (
    <span className={styles.stars} aria-label={ariaLabel}>
      {RATING_GRADES.filter((g) => g >= 1).map((g) => (
        <span key={g} className={`${styles.s} ${g <= grade ? styles.on : ''}`}>
          ★
        </span>
      ))}
    </span>
  );
}
