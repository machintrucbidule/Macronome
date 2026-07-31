import type { MealEntry } from '@macronome/shared';
import type { LineRow } from '../../logic/lineRows';
import { FoodLine } from '../FoodLine/FoodLine';
import { LineHeader } from './LineHeader';
import styles from './meal-column.module.css';

// The meal's line grid: the column sub-header + one FoodLine per row (filled or empty, B-028).
// Extracted from MealColumn when the header gained the copy button (CP-2/B-248) and the
// component crossed the per-function line cap; the markup is unchanged.
interface Props {
  mealId: string;
  mealIndex: number;
  rows: LineRow[];
  isEditing: (row: number, entry: MealEntry | null) => boolean;
  dnd: Parameters<typeof FoodLine>[0]['dnd'];
  touch: Parameters<typeof FoodLine>[0]['touch'];
}

export function MealLines({ mealId, mealIndex, rows, isEditing, dnd, touch }: Props) {
  return (
    <div className={styles.lines}>
      <LineHeader />
      {rows.map(({ row, entry }) => (
        <FoodLine
          key={entry?.id || `empty-${row}`}
          mealId={mealId}
          mealIndex={mealIndex}
          row={row}
          entry={entry}
          editing={isEditing(row, entry)}
          dnd={dnd}
          touch={touch}
        />
      ))}
    </div>
  );
}
