import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { SearchField } from '../../../components/Form/SearchField';
import { FiltersPopover, type MinRating, type VisibilityFilter } from './FiltersPopover';
import styles from '../foods.module.css';

// Aliments toolbar: title + count, search field, filters popover, "+ Ajouter" CTA
// (specifications/screens/food-db.md).
interface FoodsToolbarProps {
  /** Rows matching the current filters, server-side (B-279). Undefined before page 1: the
   *  chip stays empty rather than showing a number that would immediately change. */
  count: number | undefined;
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  showArchived: boolean;
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onShowArchived: (v: boolean) => void;
  onAdd: () => void;
}

export function FoodsToolbar(props: FoodsToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <h1>{t('foods.title')}</h1>
      <span className={styles.count}>
        {props.count === undefined ? '' : t('foods.count', { count: props.count })}
      </span>
      <SearchField
        value={props.q}
        placeholder={t('foods.searchPlaceholder')}
        onChange={(e) => props.onQ(e.target.value)}
      />
      <FiltersPopover
        minRating={props.minRating}
        visibility={props.visibility}
        showArchived={props.showArchived}
        onMinRating={props.onMinRating}
        onVisibility={props.onVisibility}
        onShowArchived={props.onShowArchived}
      />
      <Button className={styles.addbtn} onClick={props.onAdd}>
        {t('foods.add')}
      </Button>
    </div>
  );
}
