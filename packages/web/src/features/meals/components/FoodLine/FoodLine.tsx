import type { MealEntry } from '@macronome/shared';
import { useTranslation } from 'react-i18next';
import { useMeals } from '../../MealsContext';
import { useFood } from '../../hooks/useFoodLookup';
import { r0 } from '../../format';
import { QtyCell } from './QtyCell';
import { InlineFoodSearch } from '../InlineFoodSearch/InlineFoodSearch';
import styles from './food-line.module.css';

// One log line: empty (click to add), referenced (name from the foods API + editable qty), or
// custom (manual values). Macros shown are the server's consumed values (after any leftover
// proration); the web only renders them. The body is split per state to keep each unit simple.
interface FoodLineProps {
  mealId: string;
  mealIndex: number;
  entry: MealEntry | null;
  editing: boolean;
}

function EmptyLine({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className={`${styles.line} ${styles.empty}`} onClick={onAdd}>
      <span className={styles.grip} />
      <div className={styles.nm}>{label}</div>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function EntryRow({
  mealId,
  mealIndex,
  entry,
}: {
  mealId: string;
  mealIndex: number;
  entry: MealEntry;
}) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const isCustom = entry.kind === 'custom';
  const food = useFood(isCustom ? null : entry.food_id);
  const name = isCustom ? (entry.custom_name ?? '') : (food.data?.data.name ?? '…');
  const isZero = !isCustom && entry.served_quantity === 0;
  const c = entry.consumed;

  return (
    <div className={`${styles.line} ${isZero ? styles.zero : ''}`}>
      <span className={styles.grip} />
      <div
        className={styles.nm}
        title={name}
        onClick={() =>
          isCustom
            ? actions.openCustom(mealId, mealIndex, entry.id)
            : actions.startEdit(mealId, mealIndex, entry.id)
        }
      >
        {name}
        {isCustom && (
          <span className={styles.pen} title={t('meals.line.manual')}>
            ✎
          </span>
        )}
      </div>
      {isCustom ? (
        <span className={styles.qtyCustom}>
          {entry.served_grams ? `${r0(entry.served_grams)} g` : '—'}
        </span>
      ) : (
        <QtyCell mealId={mealId} entry={entry} />
      )}
      <span className={`${styles.v} num`} style={{ fontWeight: 700 }}>
        {r0(c.kcal)}
      </span>
      <span className={`${styles.v} num`}>{r0(c.fat)}</span>
      <span className={`${styles.v} num`}>{r0(c.carb)}</span>
      <span className={`${styles.v} num`}>{r0(c.protein)}</span>
      <span className={styles.pin} title={t('meals.line.pinSoon')}>
        📌
      </span>
      <button
        type="button"
        className={styles.del}
        title={t('common.remove')}
        onClick={() => void actions.deleteEntry(mealId, entry.id)}
      >
        ×
      </button>
    </div>
  );
}

export function FoodLine({ mealId, mealIndex, entry, editing }: FoodLineProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const referencedId = entry?.kind === 'referenced' ? entry.food_id : null;
  const food = useFood(referencedId);

  if (editing) {
    return (
      <div className={`${styles.line} ${styles.editing}`}>
        <span className={styles.grip} />
        <div className={styles.search}>
          <InlineFoodSearch
            mealId={mealId}
            mealIndex={mealIndex}
            entryId={entry?.id ?? null}
            initialName={food.data?.data.name ?? ''}
            currentFoodId={referencedId}
          />
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <EmptyLine
        label={t('meals.line.addFood')}
        onAdd={() => actions.startEdit(mealId, mealIndex, null)}
      />
    );
  }

  return <EntryRow mealId={mealId} mealIndex={mealIndex} entry={entry} />;
}
