import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { SelectCheckbox } from '../../../components/BulkEdit';
import type { IdSelection } from '../../../lib/useIdSelection';
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
  /** Batch selection (BE-1). The header box selects the whole FILTERED set, not the loaded rows —
   *  the page only holds 50 — so the page resolves it server-side and hands the result down. */
  selection: IdSelection;
  onSelectAll: (checked: boolean) => void;
  /** Rows matching the filters, so the header box knows when "all" has been reached. */
  total: number | undefined;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

const COLUMNS = 12;

/** The header row, extracted so `FoodTable` stays inside the per-function line cap after BE-1
 *  added the selection column. */
function Head({
  sort,
  dir,
  onSort,
  selection,
  onSelectAll,
  total,
}: Pick<FoodTableProps, 'sort' | 'dir' | 'onSort' | 'selection' | 'onSelectAll' | 'total'>) {
  const { t } = useTranslation();
  const allSelected = total !== undefined && total > 0 && selection.count === total;
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
    <thead>
      <tr>
        <th className={styles.selectCell}>
          <SelectCheckbox
            checked={allSelected}
            indeterminate={selection.count > 0}
            onChange={onSelectAll}
            ariaLabel={t('bulk.selectAll')}
          />
        </th>
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
  );
}

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
  selection,
  onSelectAll,
  total,
  rowsRef,
}: FoodTableProps) {
  const row = (food: Food) => (
    <FoodRow
      key={food.id}
      food={food}
      selected={selection.isSelected(food.id)}
      onToggle={selection.toggle}
      onOpen={onOpen}
      onArchive={onArchive}
      onRestore={onRestore}
    />
  );
  return (
    <div className={tableStyles.wrap}>
      {/* B-284: the feature class carries the declared column widths (foods.module.css). */}
      <table className={`${tableStyles.table} ${styles.foodsTable}`}>
        <Head
          sort={sort}
          dir={dir}
          onSort={onSort}
          selection={selection}
          onSelectAll={onSelectAll}
          total={total}
        />
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
