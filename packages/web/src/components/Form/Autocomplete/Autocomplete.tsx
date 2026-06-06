import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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
  /** Inline badge label, e.g. "portion" or "recette". */
  tag?: string;
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
}: ListProps) {
  return (
    <div className={styles.ac} id={listId} role="listbox">
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
            {highlightMatch(item.name, query, styles.em)}
            {item.tag && <span className={styles.tag}>{item.tag}</span>}
          </span>
          {item.meta && <span className={styles.meta}>{item.meta}</span>}
        </div>
      ))}
      {items.length === 0 && <div className={styles.empty}>{emptyLabel}</div>}
      {onCustom && customOptionLabel && (
        <div
          className={styles.customOpt}
          onMouseDown={(e) => {
            e.preventDefault();
            onCustom();
          }}
        >
          {customOptionLabel}
        </div>
      )}
    </div>
  );
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
}: AutocompleteProps) {
  // Highlight defaults to the first suggestion (B-023): so Enter selects the first match
  // without an explicit ↑/↓. `activeIndex` clamps `hi` to the (async) item list.
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const activeIndex = items.length === 0 ? -1 : Math.min(Math.max(hi, 0), items.length - 1);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  useEffect(() => setHi(0), [query]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (items.length && e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, items.length - 1));
    } else if (items.length && e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item && !item.disabled) onPick(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else {
      onInputKeyDown?.(e);
    }
  };

  return (
    <div className={styles.wrap}>
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
      />
    </div>
  );
}
