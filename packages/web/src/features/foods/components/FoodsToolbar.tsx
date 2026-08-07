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
  /** Batch-edit control (BE-1), rendered left of the filters. Absent in catalog mode, where a
   *  read-only reference table has nothing to edit. */
  bulk?: ReactNode;
  /** How many rows are ticked (BE-1). Shown **under** the count on the left rather than beside
   *  the search field, which it was costing width (owner follow-up); 0 shows nothing. */
  selectedCount?: number | undefined;
  onAdd: () => void;
  /** Disabled in catalog mode, where adding is per row (B-292). Greyed rather than removed,
   *  so the toolbar keeps its geometry when switching mode. */
  addDisabled?: boolean;
}

export function FoodsToolbar(props: FoodsToolbarProps) {
  const { t } = useTranslation();
  const selected = props.selectedCount ?? 0;
  return (
    <div className={styles.toolbar}>
      <h1>{t('foods.title')}</h1>
      {/* The selection read-out is absolutely positioned under the count, so ticking rows never
          changes the toolbar's height. */}
      <span className={styles.countCell}>
        <span className={styles.count}>
          {props.count === undefined ? '' : t(props.countKey, { count: props.count })}
        </span>
        {selected > 0 && (
          <span className={styles.selectedCount}>{t('bulk.selected', { count: selected })}</span>
        )}
      </span>
      <SearchField
        value={props.q}
        placeholder={t('foods.searchPlaceholder')}
        onChange={(e) => props.onQ(e.target.value)}
      />
      {props.bulk}
      {props.filters}
      <Button className={styles.addbtn} onClick={props.onAdd} disabled={props.addDisabled ?? false}>
        {t('foods.add')}
      </Button>
    </div>
  );
}
