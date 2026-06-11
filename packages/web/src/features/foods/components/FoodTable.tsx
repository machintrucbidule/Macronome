import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { FoodRow } from './FoodRow';

// Sortable foods table (specifications/screens/food-db.md). Sortable columns:
// Nom·kcal·L·G·P·Note·Visib·Utilisation. The Portion column is display-only (DECISIONS Gap #10).
// `usage` is the 90-day meal-log count (FU-1/B-151); default sort stays A→Z (name).
export type SortField =
  | 'name'
  | 'kcal'
  | 'fat'
  | 'carb'
  | 'protein'
  | 'rating'
  | 'visibility'
  | 'usage';

interface FoodTableProps {
  foods: Food[];
  sort: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onOpen: (food: Food) => void;
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
}

export function FoodTable({
  foods,
  sort,
  dir,
  onSort,
  onOpen,
  onArchive,
  onRestore,
}: FoodTableProps) {
  const { t } = useTranslation();
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
      <table className={tableStyles.table}>
        <thead>
          <tr>
            {th('name', 'left')}
            {th('kcal', 'right')}
            {th('fat', 'center')}
            {th('carb', 'center')}
            {th('protein', 'center')}
            <th>{t('foods.col.portion')}</th>
            {th('rating', 'center')}
            {th('visibility', 'center')}
            {th('usage', 'right')}
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
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
