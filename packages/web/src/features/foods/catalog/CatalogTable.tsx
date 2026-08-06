import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { TableSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import { CatalogRow } from './CatalogRow';
import type { CatalogSortField } from './useCatalogFilters';
import styles from './catalog.module.css';

// Ciqual catalog table (B-292). Six columns only — Nom (elastic, with the food group on a
// sub-line), kcal, L, G, P and the add action — so unlike the Aliments table it needs no
// narrow-desktop band: the declared widths leave the name plenty of room at every size.
interface CatalogTableProps {
  /** The whole result set: loaded rows, loading placeholders and reserved gaps (LD-1/B-303). */
  slots: Slot<FoodRef>[];
  /** Slots belonging to page 0 — the measured container holds those and nothing else. */
  head: number;
  /** Measured row height, sizing the placeholders and gaps. */
  pitch: number;
  sort: CatalogSortField;
  dir: 'asc' | 'desc';
  onSort: (field: CatalogSortField) => void;
  onAdopt: (ref: FoodRef) => void;
  /** Page 0's container, measured for the row pitch (B-278, re-scoped by B-303). */
  rowsRef?: RefObject<HTMLElement | null>;
}

const COLUMNS = 6;

export function CatalogTable({
  slots,
  head,
  pitch,
  sort,
  dir,
  onSort,
  onAdopt,
  rowsRef,
}: CatalogTableProps) {
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
        {/* Page 0 alone in the measured box: a placeholder inside it would corrupt the pitch. */}
        <tbody ref={rowsRef as RefObject<HTMLTableSectionElement>}>
          <TableSlots slots={slots.slice(0, head)} pitch={pitch} columns={COLUMNS}>
            {(ref_) => <CatalogRow key={ref_.id} ref_={ref_} onAdopt={onAdopt} />}
          </TableSlots>
        </tbody>
        <tbody>
          <TableSlots slots={slots.slice(head)} pitch={pitch} columns={COLUMNS} offset={head}>
            {(ref_) => <CatalogRow key={ref_.id} ref_={ref_} onAdopt={onAdopt} />}
          </TableSlots>
        </tbody>
      </table>
    </div>
  );
}
