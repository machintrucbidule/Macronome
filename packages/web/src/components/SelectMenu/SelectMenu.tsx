import { useEffect, useRef, useState } from 'react';
import styles from './SelectMenu.module.css';

// Generic clickable-badge + dropdown menu, styled like the OK/NOK/Auto verdict menu
// (design/components/badges-verdict.md + metric-cards.md §Verdict cluster). Mirrors the
// VerdictBadge open/close + outside-click + Escape pattern so a single control style is
// reused for any small inline single-select (e.g. the day activity level — B-085). The
// per-option `className` is applied to both the matching menu item and the trigger, so the
// caller can colour-code options (the colour map lives with the caller, not here).

export interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
  className?: string;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string | undefined;
}

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
        <div className={styles.menu} role="listbox">
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
