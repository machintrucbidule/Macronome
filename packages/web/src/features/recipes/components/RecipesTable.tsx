import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { SelectCheckbox } from '../../../components/BulkEdit';
import type { IdSelection } from '../../../lib/useIdSelection';
import { TableSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import { RecipeRow } from './RecipeRow';
import styles from '../recipes.module.css';

// Sortable recipes table (specifications/screens/recipe.md). Every data column sorts server-side
// (RS-1/B-306); the derived macro columns and g/portion have no stored column, so the API ranks
// them over the whole match set. The screen renders, it never orders.
export type SortField =
  | 'name'
  | 'kcal'
  | 'fat'
  | 'carb'
  | 'protein'
  | 'batch'
  | 'servings'
  | 'weight_per_portion'
  | 'rating';

/** Sortable columns in table order; the mobile Trier sheet mirrors this list. */
export const SORT_KEYS: SortField[] = [
  'name',
  'kcal',
  'fat',
  'carb',
  'protein',
  'batch',
  'servings',
  'weight_per_portion',
  'rating',
];

/** Translation key per column — the wire name `weight_per_portion` keeps the existing label. */
export const SORT_LABEL: Record<SortField, string> = {
  name: 'name',
  kcal: 'kcal',
  fat: 'fat',
  carb: 'carb',
  protein: 'protein',
  batch: 'batch',
  servings: 'servings',
  weight_per_portion: 'weightPerPortion',
  rating: 'rating',
};

interface RecipesTableProps {
  /** The whole result set: loaded rows, loading placeholders and reserved gaps (LD-1/B-303). */
  slots: Slot<RecipeSummary>[];
  /** Slots belonging to page 0 — the measured container holds those and nothing else. */
  head: number;
  /** Measured row height, sizing the placeholders and gaps. */
  pitch: number;
  sort: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onOpen: (recipe: RecipeSummary) => void;
  onArchive: (recipe: RecipeSummary) => void;
  onRestore: (recipe: RecipeSummary) => void;
  /** Batch selection (BE-1/B-308) — the header box selects the whole FILTERED set, not the loaded
   *  rows, so the page resolves it server-side and hands the result down. */
  selection: IdSelection;
  onSelectAll: (checked: boolean) => void;
  total: number | undefined;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

const COLUMNS = 11;

export function RecipesTable({
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
}: RecipesTableProps) {
  const { t } = useTranslation();
  const row = (recipe: RecipeSummary) => (
    <RecipeRow
      key={recipe.id}
      recipe={recipe}
      selected={selection.isSelected(recipe.id)}
      onToggle={selection.toggle}
      onOpen={onOpen}
      onArchive={onArchive}
      onRestore={onRestore}
    />
  );
  const allSelected = total !== undefined && total > 0 && selection.count === total;
  const th = (field: SortField, align: 'left' | 'right' | 'center') => (
    <SortableTh
      field={field}
      active={sort === field}
      dir={dir}
      align={align}
      onSort={(f) => onSort(f as SortField)}
    >
      {t(`recipes.col.${SORT_LABEL[field]}`)}
    </SortableTh>
  );
  return (
    <div className={tableStyles.wrap}>
      {/* B-284: the feature class carries the declared column widths (recipes.module.css). */}
      <table className={`${tableStyles.table} ${styles.recipesTable}`}>
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
            {th('batch', 'center')}
            {th('servings', 'center')}
            {th('weight_per_portion', 'center')}
            {th('rating', 'center')}
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
