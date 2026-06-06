import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal, MealEntry } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { buildLineRows } from '../../logic/lineRows';
import { useLineDnd } from '../../hooks/useLineDnd';
import { FoodLine } from '../FoodLine/FoodLine';
import { LineHeader } from './LineHeader';
import { MealHeader } from './MealHeader';
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
}

export function MealColumn({ meal, index, meals, width }: MealColumnProps) {
  const { t } = useTranslation();
  const { editing, mutations, actions } = useMeals();
  const [confirming, setConfirming] = useState(false);
  const rows = buildLineRows(meal.entries, MIN_LINES);
  const byRow = new Map<number, MealEntry>(
    rows.flatMap((r) => (r.entry ? ([[r.row, r.entry]] as const) : [])),
  );
  const dnd = useLineDnd(meal.id, byRow, (id, order) => void actions.reorderEntries(id, order));

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
    <div className={styles.col} style={{ width, flexBasis: width }}>
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
      />
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
