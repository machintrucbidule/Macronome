import { useTranslation } from 'react-i18next';
import type { MealEntry } from '@macronome/shared';
import { useFood } from '../../hooks/useFoodLookup';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Selectable list of the meal's weighed lines (served_grams > 0) for the leftover deduction.
// Zero-weight pantry lines and weightless customs are excluded upstream. Names for referenced
// lines come from the foods API.
interface LineSelectorProps {
  entries: MealEntry[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}

function Row({
  entry,
  checked,
  onToggle,
}: {
  entry: MealEntry;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  const food = useFood(entry.kind === 'referenced' ? entry.food_id : null);
  const name = entry.kind === 'custom' ? (entry.custom_name ?? '') : (food.data?.data.name ?? '…');
  return (
    <label className={styles.loRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span className={styles.loName}>{name}</span>
      <span className={styles.loG}>{r0(entry.served_grams)} g</span>
    </label>
  );
}

export function LineSelector({ entries, selected, onToggle }: LineSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.loLines}>
      <div className={styles.loHead}>{t('meals.leftover.linesHead')}</div>
      {entries.length === 0 && <div className={styles.loEmpty}>{t('meals.leftover.noLines')}</div>}
      {entries.map((e) => (
        <Row
          key={e.id}
          entry={e}
          checked={selected.has(e.id)}
          onToggle={(on) => onToggle(e.id, on)}
        />
      ))}
    </div>
  );
}
