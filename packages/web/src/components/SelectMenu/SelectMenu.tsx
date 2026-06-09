import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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

// Find the nearest ancestor that clips (overflow auto/scroll/hidden) — e.g. the modal panel
// (`.modal { overflow:auto }`). The menu must stay inside its box or it gets cut off (B-121).
function clipBox(el: HTMLElement | null): { left: number; right: number } {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n);
    if (/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY)) {
      const r = n.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }
  }
  return { left: 0, right: window.innerWidth };
}

// Right-align the menu under the trigger by default; flip to left-align and clamp when that
// would spill past the clipping ancestor's edge, so the list is never hidden (B-121). Returns
// the horizontal offset (px, relative to the trigger) to apply as the menu's `left`.
function useMenuOffset(
  open: boolean,
  wrapRef: RefObject<HTMLDivElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  count: number,
): number | null {
  const [offset, setOffset] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setOffset(null);
      return;
    }
    const place = (): void => {
      const trigger = wrapRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const tr = trigger.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const box = clipBox(trigger);
      const margin = 8;
      let left = tr.right - mw; // right-aligned
      if (left < box.left + margin) left = tr.left; // flip to left-aligned
      left = Math.max(box.left + margin, Math.min(left, box.right - mw - margin));
      setOffset(left - tr.left);
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, count, wrapRef, menuRef]);
  return offset;
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
  const offset = useMenuOffset(open, wrapRef, menuRef, options.length);

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
          className={`${styles.menu} ${menuClassName ?? ''}`}
          role="listbox"
          ref={menuRef}
          style={offset == null ? undefined : { left: offset, right: 'auto' }}
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
