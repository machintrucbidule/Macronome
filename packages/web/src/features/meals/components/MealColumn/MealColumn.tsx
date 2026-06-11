import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal, MealEntry } from '@macronome/shared';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useMeals } from '../../MealsContext';
import { buildLineRows } from '../../logic/lineRows';
import { useLineDnd } from '../../hooks/useLineDnd';
import { useTouchReorder } from '../../hooks/useTouchReorder';
import { useMealPhotoEntry } from '../../hooks/useMealPhotoEntry';
import { FoodLine } from '../FoodLine/FoodLine';
import { LineHeader } from './LineHeader';
import { MealHeader } from './MealHeader';
import { MealPhotoButton } from './MealPhotoButton';
import { MealPhotoFeedback } from './MealPhotoFeedback';
import { MealFooter } from './MealFooter';
import { MealDeleteConfirm } from './MealDeleteConfirm';
import styles from './meal-column.module.css';

// One meal as a column: header + sub-header + the lines + footer totals. Each entry sits at
// its order_index row; the remaining rows are clickable "+ aliment" empties (B-028). The grip
// drag-reorders lines (B-029). Domain values come from the server (the web never computes).
const MIN_LINES = 15;

interface MealColumnProps {
  meal: Meal;
  index: number;
  meals: Meal[];
  width: number;
  // Mobile meal-tab layer (S4): ≤560px CSS shows only the active column (every column stays
  // mounted). The flag is surfaced as a `data-meal-col` attribute the scroller's mobile rule
  // targets; it has no effect on desktop (no ≥561px rule reads it).
  active?: boolean;
}

export function MealColumn({ meal, index, meals, width, active = false }: MealColumnProps) {
  const { t } = useTranslation();
  const { editing, mutations, actions } = useMeals();
  const [confirming, setConfirming] = useState(false);
  const rows = buildLineRows(meal.entries, MIN_LINES);
  const byRow = new Map<number, MealEntry>(
    rows.flatMap((r) => (r.entry ? ([[r.row, r.entry]] as const) : [])),
  );
  const dnd = useLineDnd(meal.id, byRow, (id, order) => void actions.reorderEntries(id, order));
  // Mobile long-press touch reorder (S9) runs alongside the desktop native DnD; both commit through
  // the same reorder action. Inert on desktop (mouse pointers are ignored + handlers unattached).
  const isMobile = useIsMobile();
  const touch = useTouchReorder(isMobile, byRow, (o) => void actions.reorderEntries(meal.id, o));
  // Mobile one-tap photo → AI → custom line (QP-1/B-158); wiring + state live in the hook.
  const photo = useMealPhotoEntry(meal);

  const isEditing = (row: number, entry: MealEntry | null): boolean => {
    if (!editing || editing.mealIndex !== meal.order_index) return false;
    return entry
      ? editing.entryId === entry.id
      : editing.entryId === null && editing.orderIndex === row;
  };

  const swap = (other: Meal): void => {
    void mutations.patchMeal.mutateAsync({
      mealId: meal.id,
      body: { order_index: other.order_index },
    });
    void mutations.patchMeal.mutateAsync({
      mealId: other.id,
      body: { order_index: meal.order_index },
    });
  };

  return (
    <div
      className={styles.col}
      style={{ width, flexBasis: width }}
      data-meal-col={active ? 'active' : 'idle'}
    >
      <MealHeader
        name={meal.slot_name}
        canMoveLeft={index > 0}
        canMoveRight={index < meals.length - 1}
        onCook={() => actions.openCook(meal.id)}
        onRename={() => {
          const next = window.prompt(t('meals.meal.renamePrompt'), meal.slot_name);
          if (next) void actions.renameMeal(meal.id, next);
        }}
        onMoveLeft={() => index > 0 && swap(meals[index - 1] as Meal)}
        onMoveRight={() => index < meals.length - 1 && swap(meals[index + 1] as Meal)}
        onDelete={() => setConfirming(true)}
        extra={photo.ready ? <MealPhotoButton busy={photo.busy} onClick={photo.trigger} /> : null}
      />
      <MealPhotoFeedback photo={photo} />
      <div className={styles.lines}>
        <LineHeader />
        {rows.map(({ row, entry }) => (
          <FoodLine
            key={entry?.id || `empty-${row}`}
            mealId={meal.id}
            mealIndex={meal.order_index}
            row={row}
            entry={entry}
            editing={isEditing(row, entry)}
            dnd={dnd}
            touch={touch}
          />
        ))}
      </div>
      <MealFooter mealId={meal.id} totals={meal.totals} />
      {confirming && (
        <MealDeleteConfirm
          name={meal.slot_name}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void actions.deleteMeal(meal.id);
          }}
        />
      )}
    </div>
  );
}
