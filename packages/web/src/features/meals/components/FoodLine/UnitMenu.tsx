import { useEffect, useRef } from 'react';
import type { EntryUnit } from '@macronome/shared';
import { useFood } from '../../hooks/useFoodLookup';
import styles from './food-line.module.css';

// Unit picker for a referenced line: the SI units plus the food's named portions
// (specifications/screens/meals.md §Interactions — "no generic nb"). Portions are fetched
// lazily when the menu opens. Selecting a portion sets unit='portion' + its portion_id.
const SI_UNITS: EntryUnit[] = ['g', 'ml', 'kg'];

interface UnitMenuProps {
  foodId: string | null;
  currentUnit: EntryUnit;
  currentPortionId: string | null;
  onSelect: (unit: EntryUnit, portionId: string | null) => void;
  onClose: () => void;
}

export function UnitMenu({
  foodId,
  currentUnit,
  currentPortionId,
  onSelect,
  onClose,
}: UnitMenuProps) {
  const food = useFood(foodId);
  const ref = useRef<HTMLDivElement>(null);
  const portions = food.data?.data.named_portions ?? [];

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div className={styles.unitMenu} ref={ref}>
      {SI_UNITS.map((u) => (
        <button
          key={u}
          type="button"
          className={currentUnit === u ? styles.cur : ''}
          onClick={() => onSelect(u, null)}
        >
          {u}
        </button>
      ))}
      {portions.map((p) => (
        <button
          key={p.id}
          type="button"
          className={currentUnit === 'portion' && currentPortionId === p.id ? styles.cur : ''}
          onClick={() => onSelect('portion', p.id)}
        >
          {p.label} ({p.grams} g)
        </button>
      ))}
    </div>
  );
}
