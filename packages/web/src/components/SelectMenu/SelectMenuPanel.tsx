import type { Ref } from 'react';
import type { SelectMenuOption } from './SelectMenu';
import styles from './SelectMenu.module.css';

// The dropdown panel of SelectMenu, split out to keep the control itself readable. Options are
// buttons with role="option" and tabIndex -1: focus stays on the trigger, which points at the
// highlighted one through aria-activedescendant (forms-inputs.md §Select).
interface SelectMenuPanelProps<T extends string> {
  listId: string;
  options: SelectMenuOption<T>[];
  value: T;
  active: number;
  isField: boolean;
  dropUp: boolean;
  left: number | null;
  /** Height ceiling from useMenuPlacement; the panel scrolls inside it. */
  maxHeight: number | null;
  menuClassName?: string | undefined;
  panelRef: Ref<HTMLDivElement>;
  onChoose: (value: T) => void;
}

export function SelectMenuPanel<T extends string>({
  listId,
  options,
  value,
  active,
  isField,
  dropUp,
  left,
  maxHeight,
  menuClassName,
  panelRef,
  onChoose,
}: SelectMenuPanelProps<T>) {
  const cls = [styles.menu, dropUp ? styles.up : '', isField ? styles.menuField : '', menuClassName]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      id={listId}
      role="listbox"
      ref={panelRef}
      style={{
        ...(left == null ? {} : { left, right: 'auto' }),
        ...(maxHeight == null ? {} : { maxHeight }),
      }}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          id={`${listId}-${i}`}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={o.value === value}
          className={[
            o.className ?? '',
            o.value === value ? styles.selected : '',
            i === active ? styles.active : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChoose(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
