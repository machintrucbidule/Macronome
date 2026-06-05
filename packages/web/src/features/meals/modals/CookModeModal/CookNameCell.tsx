import { useTranslation } from 'react-i18next';
import { useFood } from '../../hooks/useFoodLookup';
import type { CookLine } from './useCookSession';
import styles from './cook-mode.module.css';

// Cook-mode name cell: while this line is being searched it echoes the query (the A–Z keyboard
// feeds it); otherwise it shows the food name (resolved from the API) as a tap target. Custom
// lines show their name read-only.
interface CookNameCellProps {
  line: CookLine;
  searching: boolean;
  query: string;
  onSelectName: () => void;
}

export function CookNameCell({ line, searching, query, onSelectName }: CookNameCellProps) {
  const { t } = useTranslation();
  const isCustom = line.kind === 'custom';
  const food = useFood(isCustom ? null : line.food_id);
  const name = isCustom ? (line.custom_name ?? '') : (food.data?.data.name ?? '…');

  if (searching) {
    return (
      <div className={styles.csearch}>
        <input readOnly value={query} placeholder={t('meals.cook.searchPlaceholder')} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.cname} ${isCustom ? styles.cnameCustom : ''}`}
      disabled={isCustom}
      title={name}
      onClick={onSelectName}
    >
      {name}
    </button>
  );
}
