import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { SearchField } from '../../../components/Form/SearchField';
import styles from '../foods.module.css';

// Aliments toolbar: title + count, search field, the mode's own filters popover, and the
// "+ Ajouter" CTA (specifications/screens/food-db.md). Shared by both modes (B-292): the
// filters differ between Mes aliments and Catalogue Ciqual, so they arrive as a slot rather
// than as a prop chain through this component that keeps growing with each new filter.
interface FoodsToolbarProps {
  /** Rows matching the current filters, server-side (B-279). Undefined before page 1: the
   *  chip stays empty rather than showing a number that would immediately change. */
  count: number | undefined;
  /** Count wording — the catalog counts reference entries, not the user's own foods. */
  countKey: string;
  q: string;
  onQ: (q: string) => void;
  filters: ReactNode;
  onAdd: () => void;
  /** Disabled in catalog mode, where adding is per row (B-292). Greyed rather than removed,
   *  so the toolbar keeps its geometry when switching mode. */
  addDisabled?: boolean;
}

export function FoodsToolbar(props: FoodsToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <h1>{t('foods.title')}</h1>
      <span className={styles.count}>
        {props.count === undefined ? '' : t(props.countKey, { count: props.count })}
      </span>
      <SearchField
        value={props.q}
        placeholder={t('foods.searchPlaceholder')}
        onChange={(e) => props.onQ(e.target.value)}
      />
      {props.filters}
      <Button className={styles.addbtn} onClick={props.onAdd} disabled={props.addDisabled ?? false}>
        {t('foods.add')}
      </Button>
    </div>
  );
}
