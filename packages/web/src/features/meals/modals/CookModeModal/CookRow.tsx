import type { EntryUnit } from '@macronome/shared';
import { CookNameCell } from './CookNameCell';
import { CookUnitCell } from './CookUnitCell';
import type { CookLine, CookMode } from './useCookSession';
import styles from './cook-mode.module.css';

// One cook-mode ingredient row: name · quantity · unit, in large type. Tapping the name (referenced
// only) enters search mode; tapping the quantity selects it for the keypad; the unit cell owns its
// own menu. Custom lines are read-only (their weight is managed in the custom editor). The name and
// unit cells live in their own files; this row is just the layout + the quantity tap target.
interface CookRowProps {
  line: CookLine;
  selected: boolean;
  mode: CookMode;
  query: string;
  displayQty: string;
  onSelectName: () => void;
  onSelectQty: () => void;
  onSetUnit: (unit: EntryUnit, portionId: string | null) => void;
}

export function CookRow({
  line,
  selected,
  mode,
  query,
  displayQty,
  onSelectName,
  onSelectQty,
  onSetUnit,
}: CookRowProps) {
  const isCustom = line.kind === 'custom';
  const rowCls = `${styles.cookRow} ${selected ? styles.sel : ''} ${
    selected && mode === 'qty' ? styles.qmode : ''
  }`;

  return (
    <div className={rowCls}>
      <CookNameCell
        line={line}
        searching={selected && mode === 'name'}
        query={query}
        onSelectName={onSelectName}
      />
      {isCustom ? (
        <span className={styles.cqtyFixed}>{displayQty}</span>
      ) : (
        <button type="button" className={styles.cqty} onClick={onSelectQty}>
          {displayQty}
        </button>
      )}
      <CookUnitCell line={line} onSetUnit={onSetUnit} />
    </div>
  );
}
