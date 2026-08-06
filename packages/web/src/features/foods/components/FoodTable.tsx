import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { FoodRow } from './FoodRow';
import { TableSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import styles from '../foods.module.css';

// Sortable foods table (specifications/screens/food-db.md). Sortable columns:
// Nom·kcal·L·G·P·Note·Source·Visib·Utilisation. The Portion column is display-only
// (DECISIONS Gap #10). `usage` is the 90-day meal-log count (FU-1/B-151); default sort stays
// A→Z (name). Source (B-291) sits between Note and Visib. and is hidden below 960px — see the
// band arithmetic in foods.module.css.
export type SortField =
  | 'name'
  | 'kcal'
  | 'fat'
  | 'carb'
  | 'protein'
  | 'rating'
  | 'source'
  | 'visibility'
  | 'usage';

interface FoodTableProps {
  /** The whole result set: loaded rows, loading placeholders and reserved gaps (LD-1/B-303). */
  slots: Slot<Food>[];
  /** Slots belonging to page 0 — the measured container holds those and nothing else. */
  head: number;
  /** Measured row height, sizing the placeholders and gaps. */
  pitch: number;
  sort: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onOpen: (food: Food) => void;
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

const COLUMNS = 11;

export function FoodTable({
  slots,
  head,
  pitch,
  sort,
  dir,
  onSort,
  onOpen,
  onArchive,
  onRestore,
  rowsRef,
}: FoodTableProps) {
  const { t } = useTranslation();
  const row = (food: Food) => (
    <FoodRow
      key={food.id}
      food={food}
      onOpen={onOpen}
      onArchive={onArchive}
      onRestore={onRestore}
    />
  );
  const th = (field: SortField, align: 'left' | 'right' | 'center') => (
    <SortableTh
      field={field}
      active={sort === field}
      dir={dir}
      align={align}
      onSort={(f) => onSort(f as SortField)}
    >
      {t(`foods.col.${field}`)}
    </SortableTh>
  );
  return (
    <div className={tableStyles.wrap}>
      {/* B-284: the feature class carries the declared column widths (foods.module.css). */}
      <table className={`${tableStyles.table} ${styles.foodsTable}`}>
        <thead>
          <tr>
            {th('name', 'left')}
            {th('kcal', 'right')}
            {th('fat', 'center')}
            {th('carb', 'center')}
            {th('protein', 'center')}
            <th>{t('foods.col.portion')}</th>
            {th('rating', 'center')}
            {th('source', 'center')}
            {th('visibility', 'center')}
            {th('usage', 'center')}
            <th aria-label="actions" />
          </tr>
        </thead>
        {/* Page 0 alone in the measured box: a placeholder inside it would corrupt the pitch. */}
        <tbody ref={rowsRef as RefObject<HTMLTableSectionElement>}>
          <TableSlots slots={slots.slice(0, head)} pitch={pitch} columns={COLUMNS}>
            {row}
          </TableSlots>
        </tbody>
        <tbody>
          <TableSlots slots={slots.slice(head)} pitch={pitch} columns={COLUMNS} offset={head}>
            {row}
          </TableSlots>
        </tbody>
      </table>
    </div>
  );
}
