import { useTranslation } from 'react-i18next';
import type { Rating } from '@macronome/shared';
import { RATING_GRADES, RATING_LABEL_KEYS } from '@macronome/shared';
import { SelectMenu, type SelectMenuOption } from '../SelectMenu/SelectMenu';
import { StarGlyphs } from './StarGlyphs';
import styles from './RatingStars.module.css';

// Rating picker for the food modal + recipe builder (B-121). A dropdown listing the
// five states explicitly — "Pas noté" (unrated) + 0/Bof (three empty stars) + 1/2/3
// (filled) — so unrated is unmistakably distinct from 0/Bof and every state is reachable
// in one click (design/components/rating-stars.md, DECISIONS.md Gap #7). Graded options
// show the star visual only (no text); the grade label rides along as an aria-label for
// screen readers. Built on SelectMenu, like ActivitySelect — the string<->Rating mapping
// lives here.

type Key = 'unrated' | '0' | '1' | '2' | '3';

const toKey = (r: Rating): Key => (r === null ? 'unrated' : (String(r) as Key));
const fromKey = (k: Key): Rating => (k === 'unrated' ? null : (Number(k) as Rating));

interface RatingSelectProps {
  value: Rating;
  onChange: (rating: Rating) => void;
  ariaLabel?: string | undefined;
}

export function RatingSelect({ value, onChange, ariaLabel }: RatingSelectProps) {
  const { t } = useTranslation();
  const options: SelectMenuOption<Key>[] = [
    {
      value: 'unrated',
      label: <span className={styles.unrated}>{t('rating.unrated')}</span>,
    },
    ...RATING_GRADES.map((g) => ({
      value: String(g) as Key,
      label: <StarGlyphs grade={g} ariaLabel={t(RATING_LABEL_KEYS[g])} />,
    })),
  ];
  return (
    <SelectMenu
      value={toKey(value)}
      options={options}
      onChange={(k) => onChange(fromKey(k))}
      ariaLabel={ariaLabel}
      menuClassName={styles.ratingMenu}
    />
  );
}
