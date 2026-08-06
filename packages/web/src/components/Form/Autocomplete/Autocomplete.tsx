import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useMenuPlacement } from '../../../lib/useMenuPlacement';
import { highlightMatch } from './highlight';
import styles from './Autocomplete.module.css';

// Generic food/recipe search dropdown (design/components/forms-inputs.md §Autocomplete).
// Owns the inline input + the floating list; the parent supplies the (server-searched)
// items and reacts to a pick. Keyboard: ↑/↓ move the highlight, Enter selects, Esc closes;
// keys it does not consume bubble to `onInputKeyDown` for the meal's cell navigation.

export interface AutocompleteItem {
  id: string;
  name: string;
  /** Right-aligned meta, e.g. "121 kcal /100g". */
  meta?: string;
  /** Inline badge label, e.g. "portion" or "recette" — accent-coloured. */
  tag?: string;
  /** Second, NEUTRAL badge (B-293): names where a result comes from when it is not yet one of
   *  the user's own items, e.g. "Ciqual". Grey on purpose — it qualifies, it does not classify. */
  hint?: string;
  disabled?: boolean;
}

interface AutocompleteProps {
  query: string;
  onQueryChange: (q: string) => void;
  items: AutocompleteItem[];
  /** Pre-outlined "current" item (the line's existing food). */
  currentId?: string | null;
  emptyLabel: string;
  customOptionLabel?: string;
  placeholder?: string;
  onPick: (item: AutocompleteItem) => void;
  onCustom?: () => void;
  onClose: () => void;
  /** Keys the dropdown didn't consume (Tab, edge arrows) — for cell navigation. */
  onInputKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** On mount, select the seeded text (default) so typing replaces it; false places the caret
   *  at the end instead — used for type-to-search where the seed is a char to keep typing (B-105). */
  selectOnMount?: boolean;
  /** Forward Tab picks the highlighted suggestion (then the caller advances focus) when the query
   *  is non-empty, else closes and lets focus advance — the Excel-like meal flow (B-105). */
  pickOnTab?: boolean;
}

interface ListProps {
  listId: string;
  items: AutocompleteItem[];
  hi: number;
  currentId: string | null | undefined;
  query: string;
  emptyLabel: string;
  customOptionLabel: string | undefined;
  onPick: (item: AutocompleteItem) => void;
  onHover: (i: number) => void;
  onCustom: (() => void) | undefined;
  /** Measured by useMenuPlacement in the parent (it needs the rendered height). */
  listRef: RefObject<HTMLDivElement>;
  /** Open above the field instead of below (B-233). */
  dropUp: boolean;
}

function AutocompleteList({
  listId,
  items,
  hi,
  currentId,
  query,
  emptyLabel,
  customOptionLabel,
  onPick,
  onHover,
  onCustom,
  listRef,
  dropUp,
}: ListProps) {
  // The custom option is mouse-only (never keyboard-highlighted). B-159: it leads the list when the
  // query is empty (the common "new line" case) and trails it once the user types, so Enter/Tab keep
  // selecting the first food (B-023). Empty = trimmed query, matching the Tab handler's convention.
  const customNode =
    onCustom && customOptionLabel ? (
      <div
        className={styles.customOpt}
        onMouseDown={(e) => {
          e.preventDefault();
          onCustom();
        }}
      >
        {customOptionLabel}
      </div>
    ) : null;
  const customFirst = query.trim() === '';
  return (
    <div
      ref={listRef}
      className={dropUp ? `${styles.ac} ${styles.up}` : styles.ac}
      id={listId}
      role="listbox"
    >
      {customFirst && customNode}
      {items.map((item, i) => (
        <div
          key={item.id}
          id={`${listId}-opt-${i}`}
          role="option"
          aria-selected={i === hi}
          aria-disabled={item.disabled}
          className={[
            styles.item,
            i === hi ? styles.hi : '',
            item.id === currentId ? styles.cur : '',
            item.disabled ? styles.disabled : '',
          ].join(' ')}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!item.disabled) onPick(item);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className={styles.nm}>
            <span className={styles.name}>{highlightMatch(item.name, query, styles.em)}</span>
            {item.tag && <span className={styles.tag}>{item.tag}</span>}
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
          </span>
          {item.meta && <span className={styles.meta}>{item.meta}</span>}
        </div>
      ))}
      {items.length === 0 && <div className={styles.empty}>{emptyLabel}</div>}
      {!customFirst && customNode}
    </div>
  );
}

// Input key handling, kept at module scope so the component stays under the size/complexity caps.
// ↑/↓ move the highlight, Enter/click select; Tab (when pickOnTab) picks the highlighted item on a
// non-empty query (caller advances focus) or closes on an empty one (B-105); other keys bubble.
const NOOP = (): void => {};
interface KeyCtx {
  items: AutocompleteItem[];
  activeIndex: number;
  query: string;
  pickOnTab: boolean;
  setHi: (fn: (h: number) => number) => void;
  onPick: (item: AutocompleteItem) => void;
  onClose: () => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}
function handleAcKeyDown(e: KeyboardEvent<HTMLInputElement>, c: KeyCtx): void {
  const pickActive = (): boolean => {
    const item = c.items[c.activeIndex];
    if (item && !item.disabled) {
      c.onPick(item);
      return true;
    }
    return false;
  };
  if (e.key === 'ArrowDown' && c.items.length) {
    e.preventDefault();
    c.setHi((h) => Math.min(h + 1, c.items.length - 1));
  } else if (e.key === 'ArrowUp' && c.items.length) {
    e.preventDefault();
    c.setHi((h) => Math.max(h - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    pickActive();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    c.onClose();
  } else if (e.key === 'Tab' && c.pickOnTab && !e.shiftKey) {
    if (!c.query.trim()) c.onClose();
    else if (pickActive()) e.preventDefault();
  } else {
    c.onInputKeyDown(e);
  }
}

export function Autocomplete({
  query,
  onQueryChange,
  items,
  currentId,
  emptyLabel,
  customOptionLabel,
  placeholder,
  onPick,
  onCustom,
  onClose,
  onInputKeyDown,
  selectOnMount = true,
  pickOnTab = false,
}: AutocompleteProps) {
  // Highlight defaults to the first suggestion (B-023): so Enter selects the first match
  // without an explicit ↑/↓. `activeIndex` clamps `hi` to the (async) item list.
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const activeIndex = items.length === 0 ? -1 : Math.min(Math.max(hi, 0), items.length - 1);

  // B-233: open the list upward when there is no room below it inside the nearest clipping ancestor
  // (the Repas meal-table frame, a modal panel, else the viewport) — otherwise a line near the bottom
  // of the page opened a list that could only be reached by scrolling. The shared hook already does
  // the measuring for the badge dropdowns; `open` is a constant here because the list is always
  // rendered (the host mounts/unmounts this component), and `items.length` makes it re-measure when
  // async results change the list's height. Only `dropUp` is consumed: the list is left-aligned and
  // its horizontal spill is already handled by `min-width: min(280px, 100%)` (B-228).
  const { dropUp } = useMenuPlacement(true, wrapRef, listRef, items.length);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // preventScroll: the recipe-builder ingredient search opens inside an animating bottom sheet on
    // mobile (B-206); a bare .focus() would scroll the mid-transform input into view and fight the
    // slide-up. Matches the modal focus-trap rule (design/components/modals.md).
    el.focus({ preventScroll: true });
    if (selectOnMount) el.select();
    else el.setSelectionRange(el.value.length, el.value.length); // caret at end (type-to-search)
  }, [selectOnMount]);
  useEffect(() => setHi(0), [query]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void =>
    handleAcKeyDown(e, {
      items,
      activeIndex,
      query,
      pickOnTab,
      setHi,
      onPick,
      onClose,
      onInputKeyDown: onInputKeyDown ?? NOOP,
    });

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.input}
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
      <AutocompleteList
        listId={listId}
        items={items}
        hi={activeIndex}
        currentId={currentId}
        query={query}
        emptyLabel={emptyLabel}
        customOptionLabel={customOptionLabel}
        onPick={onPick}
        onHover={setHi}
        onCustom={onCustom}
        listRef={listRef}
        dropUp={dropUp}
      />
    </div>
  );
}
