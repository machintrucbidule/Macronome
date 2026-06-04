import { useEffect, useRef } from 'react';
import type { RecipeUnit } from '@macronome/shared';
import type { NamedPortionLite } from './draft';
import styles from '../recipes.module.css';

// Unit menu for an ingredient line (specifications/screens/recipe.md): g · ml · kg, plus
// the referenced item's named portions (only if it has any). No generic "nb".
const BASE_UNITS: RecipeUnit[] = ['g', 'ml', 'kg'];

interface UnitMenuProps {
  namedPortions: NamedPortionLite[];
  onSelect: (unit: RecipeUnit, portionId: string | null) => void;
  onClose: () => void;
}

export function UnitMenu({ namedPortions, onSelect, onClose }: UnitMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div className={styles.unitMenu} ref={ref}>
      {BASE_UNITS.map((u) => (
        <button key={u} type="button" onClick={() => onSelect(u, null)}>
          {u}
        </button>
      ))}
      {namedPortions.map((p) => (
        <button key={p.id} type="button" title={p.label} onClick={() => onSelect('portion', p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
