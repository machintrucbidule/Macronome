import { useTranslation } from 'react-i18next';
import type { LeftoverPreviewLine, MealEntry } from '@macronome/shared';
import { useFood } from '../../hooks/useFoodLookup';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Served → consumed preview table (mockup .lo-preview). One row per selected line: name,
// served grams, → consumed grams (the smaller value in red). Consumed grams are the server's
// (preview endpoint) — never computed here.
interface LeftoverPreviewProps {
  entries: MealEntry[];
  lines: LeftoverPreviewLine[];
}

function Row({ entry, line }: { entry: MealEntry; line: LeftoverPreviewLine | undefined }) {
  const food = useFood(entry.kind === 'referenced' ? entry.food_id : null);
  const name = entry.kind === 'custom' ? (entry.custom_name ?? '') : (food.data?.data.name ?? '…');
  const served = line?.served_grams ?? entry.served_grams ?? 0;
  const consumed = line?.consumed_grams ?? served;
  return (
    <div className={styles.loPr}>
      <span>{name}</span>
      <span className={styles.loPrNum}>{r0(served)} g</span>
      <span className={styles.loArrow}>→</span>
      <span className={styles.loNew}>{r0(consumed)} g</span>
    </div>
  );
}

export function LeftoverPreview({ entries, lines }: LeftoverPreviewProps) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;
  const byId = new Map(lines.map((l) => [l.entry_id, l]));
  return (
    <div className={styles.loPreview}>
      <div className={styles.loPh}>{t('meals.leftover.previewHead')}</div>
      {entries.map((e) => (
        <Row key={e.id} entry={e} line={byId.get(e.id)} />
      ))}
    </div>
  );
}
