import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { TableSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import { RecipeRow } from './RecipeRow';
import styles from '../recipes.module.css';

// Sortable recipes table (specifications/screens/recipe.md). Server-sortable columns:
// Nom · Lot · Portions · Note (recipe-native). Derived macro columns (kcal/L/G/P,
// weight/portion) are display-only — they live on the derived food, not the recipe table.
export type SortField = 'name' | 'batch' | 'servings' | 'rating';

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
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

const COLUMNS = 10;

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
  rowsRef,
}: RecipesTableProps) {
  const { t } = useTranslation();
  const row = (recipe: RecipeSummary) => (
    <RecipeRow
      key={recipe.id}
      recipe={recipe}
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
      {t(`recipes.col.${field}`)}
    </SortableTh>
  );
  return (
    <div className={tableStyles.wrap}>
      {/* B-284: the feature class carries the declared column widths (recipes.module.css). */}
      <table className={`${tableStyles.table} ${styles.recipesTable}`}>
        <thead>
          <tr>
            {th('name', 'left')}
            <th className={tableStyles.r}>{t('recipes.col.kcal')}</th>
            <th className={tableStyles.c}>{t('recipes.col.fat')}</th>
            <th className={tableStyles.c}>{t('recipes.col.carb')}</th>
            <th className={tableStyles.c}>{t('recipes.col.protein')}</th>
            {th('batch', 'center')}
            {th('servings', 'center')}
            <th className={tableStyles.c}>{t('recipes.col.weightPerPortion')}</th>
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
