import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { CatalogRow } from './CatalogRow';
import type { CatalogSortField } from './useCatalogFilters';
import styles from './catalog.module.css';

// Ciqual catalog table (B-292). Six columns only — Nom (elastic, with the food group on a
// sub-line), kcal, L, G, P and the add action — so unlike the Aliments table it needs no
// narrow-desktop band: the declared widths leave the name plenty of room at every size.
interface CatalogTableProps {
  refs: FoodRef[];
  sort: CatalogSortField;
  dir: 'asc' | 'desc';
  onSort: (field: CatalogSortField) => void;
  onAdopt: (ref: FoodRef) => void;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

export function CatalogTable({ refs, sort, dir, onSort, onAdopt, rowsRef }: CatalogTableProps) {
  const { t } = useTranslation();
  const th = (field: CatalogSortField, align: 'left' | 'right' | 'center') => (
    <SortableTh
      field={field}
      active={sort === field}
      dir={dir}
      align={align}
      onSort={(f) => onSort(f as CatalogSortField)}
    >
      {t(`foods.col.${field}`)}
    </SortableTh>
  );
  return (
    <div className={tableStyles.wrap}>
      <table className={`${tableStyles.table} ${styles.catalogTable}`}>
        <thead>
          <tr>
            {th('name', 'left')}
            {th('kcal', 'right')}
            {th('fat', 'center')}
            {th('carb', 'center')}
            {th('protein', 'center')}
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody ref={rowsRef as RefObject<HTMLTableSectionElement>}>
          {refs.map((ref_) => (
            <CatalogRow key={ref_.id} ref_={ref_} onAdopt={onAdopt} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
