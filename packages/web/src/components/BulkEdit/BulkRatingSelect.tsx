import { useTranslation } from 'react-i18next';
import type { Rating } from '@macronome/shared';
import { RATING_GRADES, RATING_LABEL_KEYS } from '@macronome/shared';
import { SelectMenu, type SelectMenuOption } from '../SelectMenu/SelectMenu';
import { StarGlyphs } from '../RatingStars/StarGlyphs';
import ratingStyles from '../RatingStars/RatingStars.module.css';

// The Note field of a batch popup (BE-1). `RatingSelect`'s five states plus a sixth that the
// single-food form has no use for: **« Ne pas modifier »**, the default, which keeps each selected
// row's own grade. Kept beside RatingSelect rather than folded into it — a "leave unchanged" state
// is meaningless when editing one row, and adding it there would let it leak into every form.

/** `keep` is the field's absence from the request; the rest map to `Rating`. */
export type BulkRatingKey = 'keep' | 'unrated' | '0' | '1' | '2' | '3';

/** What the batch patch should carry: `undefined` = don't send the field at all. */
export function bulkRatingValue(key: BulkRatingKey): Rating | undefined {
  if (key === 'keep') return undefined;
  return key === 'unrated' ? null : (Number(key) as Rating);
}

interface Props {
  value: BulkRatingKey;
  onChange: (key: BulkRatingKey) => void;
  ariaLabel?: string | undefined;
}

export function BulkRatingSelect({ value, onChange, ariaLabel }: Props) {
  const { t } = useTranslation();
  const options: SelectMenuOption<BulkRatingKey>[] = [
    { value: 'keep', label: t('bulk.keep') },
    {
      value: 'unrated',
      label: <span className={ratingStyles.unrated}>{t('rating.unrated')}</span>,
    },
    ...RATING_GRADES.map((g) => ({
      value: String(g) as BulkRatingKey,
      label: <StarGlyphs grade={g} ariaLabel={t(RATING_LABEL_KEYS[g])} />,
    })),
  ];
  return (
    <SelectMenu
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
      variant="field"
    />
  );
}
