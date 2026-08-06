import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { gramsDisplay, kcalDisplay } from '../format';
import { refGroup, refName } from './refName';
import styles from './catalog.module.css';

// One Ciqual reference entry (specifications/screens/food-db.md §Catalogue Ciqual, B-292).
// The whole row opens the prefilled food form — same gesture as a row of Mes aliments; the
// "+" button only makes the action visible. Nothing is written until the form is saved.
interface CatalogRowProps {
  ref_: FoodRef;
  onAdopt: (ref: FoodRef) => void;
}

export function CatalogRow({ ref_, onAdopt }: CatalogRowProps) {
  const { t, i18n } = useTranslation();
  const name = refName(ref_, i18n.language);
  return (
    <tr
      className={`${styles.row} ${tableStyles.clickable}`}
      onClick={() => onAdopt(ref_)}
      data-food-ref={ref_.id}
    >
      <td>
        <span className={tableStyles.nameLabel} title={name}>
          {name}
        </span>
        {/* The food group, on the sub-line the Aliments table uses for the comment. */}
        <div className={styles.group}>
          {refGroup(ref_, i18n.language)}
          {ref_.already_owned && <span className={styles.owned}>{t('foods.catalog.owned')}</span>}
        </div>
      </td>
      <td className={tableStyles.num}>{kcalDisplay(ref_.kcal_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mFat}`}>{gramsDisplay(ref_.fat_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mCarb}`}>{gramsDisplay(ref_.carb_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mProt}`}>
        {gramsDisplay(ref_.protein_per_100g)}
      </td>
      <td>
        <button
          type="button"
          className={styles.addbtnRow}
          title={t('foods.catalog.add')}
          onClick={(e) => {
            e.stopPropagation();
            onAdopt(ref_);
          }}
        >
          +
        </button>
      </td>
    </tr>
  );
}
