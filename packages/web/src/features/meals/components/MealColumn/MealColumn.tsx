import { useTranslation } from 'react-i18next';
import type { Meal } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { FoodLine } from '../FoodLine/FoodLine';
import { LineHeader } from './LineHeader';
import { MealHeader } from './MealHeader';
import { MealFooter } from './MealFooter';
import styles from './meal-column.module.css';
import lineStyles from '../FoodLine/food-line.module.css';

// One meal as a column: header + sub-header + the lines (entries, then one "add" line, then
// filler rows for the spreadsheet-like minimum) + footer totals. Padding rows are inert; the
// single add-line opens the inline search. Domain values come from the server.
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
  const editingAdd = editing?.entryId === null && editing.mealIndex === meal.order_index;
  const fillerCount = Math.max(0, MIN_LINES - meal.entries.length - 1);

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
        onDelete={() => {
          if (window.confirm(t('meals.meal.deletePrompt', { name: meal.slot_name })))
            void actions.deleteMeal(meal.id);
        }}
      />
      <div className={styles.lines}>
        <LineHeader />
        {meal.entries.map((entry) => (
          <FoodLine
            key={entry.id || `pin-${entry.food_id}`}
            mealId={meal.id}
            mealIndex={meal.order_index}
            entry={entry}
            editing={editing?.entryId === entry.id}
          />
        ))}
        <FoodLine mealId={meal.id} mealIndex={meal.order_index} entry={null} editing={editingAdd} />
        {Array.from({ length: fillerCount }, (_, i) => (
          <div key={`f${i}`} className={`${lineStyles.line} ${lineStyles.empty}`} />
        ))}
      </div>
      <MealFooter mealId={meal.id} totals={meal.totals} />
    </div>
  );
}
