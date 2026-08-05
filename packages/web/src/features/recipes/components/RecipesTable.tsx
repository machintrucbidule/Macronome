import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { RecipeRow } from './RecipeRow';

// Sortable recipes table (specifications/screens/recipe.md). Server-sortable columns:
// Nom · Lot · Portions · Note (recipe-native). Derived macro columns (kcal/L/G/P,
// weight/portion) are display-only — they live on the derived food, not the recipe table.
export type SortField = 'name' | 'batch' | 'servings' | 'rating';

interface RecipesTableProps {
  recipes: RecipeSummary[];
  sort: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onOpen: (recipe: RecipeSummary) => void;
  onArchive: (recipe: RecipeSummary) => void;
  onRestore: (recipe: RecipeSummary) => void;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

export function RecipesTable({
  recipes,
  sort,
  dir,
  onSort,
  onOpen,
  onArchive,
  onRestore,
  rowsRef,
}: RecipesTableProps) {
  const { t } = useTranslation();
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
      <table className={tableStyles.table}>
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
        <tbody ref={rowsRef as RefObject<HTMLTableSectionElement>}>
          {recipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              onOpen={onOpen}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
