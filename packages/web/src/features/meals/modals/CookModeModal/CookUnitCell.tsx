import { useState } from 'react';
import type { EntryUnit } from '@macronome/shared';
import { UnitMenu } from '../../components/FoodLine/UnitMenu';
import type { CookLine } from './useCookSession';
import styles from './cook-mode.module.css';

// Cook-mode unit chip: fixed "g" for custom lines, otherwise a tap target that opens the shared
// UnitMenu (SI units + the food's named portions). Owns only its open state.
interface CookUnitCellProps {
  line: CookLine;
  onSetUnit: (unit: EntryUnit, portionId: string | null) => void;
}

export function CookUnitCell({ line, onSetUnit }: CookUnitCellProps) {
  const [open, setOpen] = useState(false);

  if (line.kind === 'custom') {
    return <span className={`${styles.cunit} ${styles.cunitFixed}`}>g</span>;
  }

  return (
    <span className={styles.cunitWrap}>
      <button type="button" className={styles.cunit} onClick={() => setOpen((o) => !o)}>
        {line.unit === 'portion' ? 'portion' : line.unit}
      </button>
      {open && (
        <UnitMenu
          foodId={line.food_id}
          currentUnit={line.unit}
          currentPortionId={line.portion_id}
          onSelect={(unit, portionId) => {
            setOpen(false);
            onSetUnit(unit, portionId);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
