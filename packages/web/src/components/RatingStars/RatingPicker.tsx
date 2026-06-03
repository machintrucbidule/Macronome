import { useTranslation } from 'react-i18next';
import type { Rating } from '@macronome/shared';
import styles from './RatingStars.module.css';

// Rating picker (food modal). Four real grades over a 3-star widget + a distinct
// unrated state (design/components/rating-stars.md, DECISIONS.md Gap #7):
//  - click star i → grade i (1=Moyen, 2=Ok, 3=Top);
//  - click the first star while it is already the value → 0/Bof (three empty stars);
//  - "effacer" → unrated (null), rendered elsewhere as an em-dash.
interface RatingPickerProps {
  value: Rating;
  onChange: (rating: Rating) => void;
}

export function RatingPicker({ value, onChange }: RatingPickerProps) {
  const { t } = useTranslation();
  const filled = value ?? 0;
  const pick = (i: number): void => onChange(i === 1 && value === 1 ? 0 : (i as Rating));
  return (
    <span className={styles.picker}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          role="button"
          tabIndex={0}
          aria-label={`${i}/3`}
          className={`${styles.s} ${value !== null && i <= filled ? styles.on : ''}`}
          onClick={() => pick(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') pick(i);
          }}
        >
          ★
        </span>
      ))}
      <button type="button" className={styles.clear} onClick={() => onChange(null)}>
        {t('foods.rating.clear')}
      </button>
    </span>
  );
}
