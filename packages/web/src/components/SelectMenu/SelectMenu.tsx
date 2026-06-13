import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useMenuPlacement } from '../../lib/useMenuPlacement';
import styles from './SelectMenu.module.css';

// Generic clickable-badge + dropdown menu, styled like the OK/NOK/Auto verdict menu
// (design/components/badges-verdict.md + metric-cards.md §Verdict cluster). Mirrors the
// VerdictBadge open/close + outside-click + Escape pattern so a single control style is
// reused for any small inline single-select (e.g. the day activity level — B-085, or the
// rating dropdown — B-121). The per-option `className` is applied to both the matching menu
// item and the trigger, so the caller can colour-code options (the colour map lives with
// the caller, not here).

export interface SelectMenuOption<T extends string> {
  value: T;
  // A plain string (e.g. the activity level) or rich content — e.g. the rating
  // dropdown renders coloured star glyphs per option (RatingSelect, B-121).
  label: ReactNode;
  className?: string;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string | undefined;
  // Extra class on the dropdown panel — lets a caller override the default min-width
  // (e.g. the rating dropdown hugs its narrow star options — B-121).
  menuClassName?: string | undefined;
}

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  menuClassName,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const placement = useMenuPlacement(open, wrapRef, menuRef, options.length);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const choose = (v: T): void => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${current?.className ?? ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.cur}>{current?.label ?? value}</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div
          className={`${styles.menu} ${placement.dropUp ? styles.up : ''} ${menuClassName ?? ''}`}
          role="listbox"
          ref={menuRef}
          style={placement.left == null ? undefined : { left: placement.left, right: 'auto' }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`${o.className ?? ''} ${o.value === value ? styles.selected : ''}`}
              onClick={() => choose(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
