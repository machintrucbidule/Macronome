import type { DragEvent } from 'react';
import type { MealEntry } from '@macronome/shared';
import { useTranslation } from 'react-i18next';
import { useMeals } from '../../MealsContext';
import { useFood } from '../../hooks/useFoodLookup';
import type { LineDnd } from '../../hooks/useLineDnd';
import { r0 } from '../../format';
import { QtyCell } from './QtyCell';
import { PinCell } from './PinCell';
import { InlineFoodSearch } from '../InlineFoodSearch/InlineFoodSearch';
import styles from './food-line.module.css';

// One log line: empty (click to add), referenced (name from the foods API + editable qty), or
// custom (manual values). Each line sits at its `row` (= order_index); the grip drag-reorders
// (B-029) and any line is a drop target. Macros shown are the server's consumed values; the
// web only renders them. The body is split per state to keep each unit simple.
interface FoodLineProps {
  mealId: string;
  mealIndex: number;
  row: number;
  entry: MealEntry | null;
  editing: boolean;
  dnd: LineDnd;
}

/** Props every line passes to make itself a drop target for the drag-reorder. */
const dropProps = (row: number, dnd: LineDnd) => ({
  onDragOver: (e: DragEvent) => e.preventDefault(),
  onDrop: () => dnd.onDrop(row),
});

/** Build an entry row's class list (kept out of the component to cap its complexity). */
function entryRowClass(isZero: boolean, isPinned: boolean, isDragging: boolean): string {
  return [
    styles.line,
    isZero && styles.zero,
    isPinned && styles.pinned,
    isDragging && styles.dragging,
  ]
    .filter(Boolean)
    .join(' ');
}

function EmptyLine({
  row,
  dnd,
  onAdd,
  label,
}: {
  row: number;
  dnd: LineDnd;
  onAdd: () => void;
  label: string;
}) {
  return (
    <div className={`${styles.line} ${styles.empty}`} onClick={onAdd} {...dropProps(row, dnd)}>
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

// The food-name cell: a keyboard tab stop in the name↔qty serpentine (meals.md §113, B-105).
// Enter/Space opens its editor; typing a character opens it already searching that character
// (type-to-search), like the click. Custom lines show the manual pen.
function NameCell({
  name,
  isCustom,
  onOpen,
}: {
  name: string;
  isCustom: boolean;
  onOpen: (initialQuery?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.nm}
      title={name}
      role="button"
      tabIndex={0}
      onClick={() => onOpen()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          onOpen(e.key); // type-to-search: seed the picker with this character
        }
      }}
    >
      {name}
      {isCustom && (
        <span className={styles.pen} title={t('meals.line.manual')}>
          ✎
        </span>
      )}
    </div>
  );
}

function EntryRow({
  mealId,
  mealIndex,
  row,
  entry,
  dnd,
}: {
  mealId: string;
  mealIndex: number;
  row: number;
  entry: MealEntry;
  dnd: LineDnd;
}) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const isCustom = entry.kind === 'custom';
  const food = useFood(isCustom ? null : entry.food_id);
  const name = isCustom ? (entry.custom_name ?? '') : (food.data?.data.name ?? '…');
  const isZero = !isCustom && entry.served_quantity === 0;
  const c = entry.consumed;
  // A pinned line is a garde-manger food: accent left-border + filled pin. Pantry is food-based,
  // so the pin only shows on referenced lines (custom lines have no food_id; see PinCell).
  const showPin = !isCustom;
  const openEdit = (initialQuery?: string): void =>
    isCustom
      ? actions.openCustom(mealId, mealIndex, entry.id)
      : actions.startEdit(mealId, mealIndex, entry.id, undefined, initialQuery);

  return (
    <div
      className={entryRowClass(isZero, entry.is_pinned, dnd.dragId === entry.id)}
      {...dropProps(row, dnd)}
    >
      <span
        className={`${styles.grip} ${styles.gripDrag}`}
        draggable
        onDragStart={() => dnd.onDragStart(entry.id, row)}
        onDragEnd={dnd.onDragEnd}
        title={t('meals.line.dragHint')}
      />
      <NameCell name={name} isCustom={isCustom} onOpen={openEdit} />
      {isCustom ? (
        <span className={styles.qtyCustom}>
          {entry.served_grams ? `${r0(entry.served_grams)} g` : '—'}
        </span>
      ) : (
        <QtyCell mealId={mealId} mealIndex={mealIndex} entry={entry} />
      )}
      <span className={`${styles.v} num`} style={{ fontWeight: 700 }}>
        {r0(c.kcal)}
      </span>
      <span className={`${styles.v} num`}>{r0(c.fat)}</span>
      <span className={`${styles.v} num`}>{r0(c.carb)}</span>
      <span className={`${styles.v} num`}>{r0(c.protein)}</span>
      <PinCell mealId={mealId} entryId={entry.id} isPinned={entry.is_pinned} show={showPin} />
      <button
        type="button"
        className={styles.del}
        tabIndex={-1}
        title={t('common.remove')}
        onClick={() => void actions.deleteEntry(mealId, entry.id)}
      >
        ×
      </button>
    </div>
  );
}

export function FoodLine({ mealId, mealIndex, row, entry, editing, dnd }: FoodLineProps) {
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
            orderIndex={row}
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
        row={row}
        dnd={dnd}
        label={t('meals.line.addFood')}
        onAdd={() => actions.startEdit(mealId, mealIndex, null, row)}
      />
    );
  }

  return <EntryRow mealId={mealId} mealIndex={mealIndex} row={row} entry={entry} dnd={dnd} />;
}
