import { useTranslation } from 'react-i18next';
import { useMeals } from '../../MealsContext';
import styles from './food-line.module.css';

// The garde-manger pin cell of a referenced food line. Interactive (toggles the pantry
// pin via the API) once the line is persisted; preview/scaffold pantry lines (id '') are
// pinned by definition and show the filled pin without a toggle yet. Custom lines have no
// food_id, so they render nothing here (the caller decides via `show`).
interface PinCellProps {
  mealId: string;
  entryId: string;
  isPinned: boolean;
  show: boolean;
}

export function PinCell({ mealId, entryId, isPinned, show }: PinCellProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  if (!show) return <span />;

  const className = `${styles.pin} ${isPinned ? styles.pinOn : ''}`;
  const title = isPinned ? t('meals.line.unpin') : t('meals.line.pin');

  if (entryId === '') {
    return (
      <span className={className} title={title}>
        📌
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-pressed={isPinned}
      onClick={() => void actions.togglePin(mealId, entryId, isPinned)}
    >
      📌
    </button>
  );
}
