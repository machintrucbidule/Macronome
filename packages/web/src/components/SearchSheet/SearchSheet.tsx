import { useRef } from 'react';
import { Modal } from '../Modal/Modal';
import { useKeyboardViewport } from '../../lib/useKeyboardViewport';
import styles from './search-sheet.module.css';

// The shared picker sheet (design/components/modals.md §The shared picker sheet, MOB-1). On phones
// it replaces the inline `Autocomplete` dropdown for all three food/recipe pickers — Repas, the
// recipe-builder ingredient block and the Paramètres garde-manger — because a dropdown anchored to
// a dense cell cannot offer a pinned search field with large tappable rows.
//
// Purely presentational and data-source agnostic: each host keeps its own query hook, item mapping
// and wording (they do not even share an endpoint), and passes them in. That is what lets one
// component serve three screens without coupling them.
//
// Mount it only behind `useIsMobile()`. Hosts must render their inline dropdown OR this sheet,
// never both: the sheet is portalled to <body>, so an outside-click listener bound to the host's own
// subtree would fire on the first tap inside the sheet (B-049 / B-095).
export interface SearchSheetItem {
  id: string;
  name: string;
  /** Inline badge, e.g. `recette` / `portion`. */
  tag?: string;
  /** Second, NEUTRAL badge (B-293): where a result comes from when it is not yet one of the
   *  user's own items, e.g. "Ciqual". */
  hint?: string;
  /** Rendered dimmed and not tappable (e.g. a recipe that would create a cycle). */
  disabled?: boolean;
}

interface SearchSheetProps {
  title: string;
  placeholder: string;
  emptyLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  items: SearchSheetItem[];
  /** Marked with the accent bar — the sheet's equivalent of the dropdown's `.cur`. */
  currentId?: string | null;
  /** Omitted → no custom row at all (the recipe builder and the pantry offer none). */
  customLabel?: string;
  onCustom?: () => void;
  /** Receives the whole item, not just its id (B-293): a Ciqual reference id is NOT a food id,
   *  and a host that looked the pick back up by id could not tell the two apart. */
  onPick: (item: SearchSheetItem) => void;
  onClose: () => void;
}

export function SearchSheet({
  title,
  placeholder,
  emptyLabel,
  query,
  onQueryChange,
  items,
  currentId = null,
  customLabel,
  onCustom,
  onPick,
  onClose,
}: SearchSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyboardViewport();

  // B-159: the custom option leads while the query is empty and trails once the user types, so the
  // first row is always the best match. Identical rule to the dropdown — the two cannot diverge.
  const customRow =
    customLabel !== undefined && onCustom ? (
      <button type="button" className={styles.custom} onClick={onCustom}>
        {customLabel}
      </button>
    ) : null;
  const customLeads = query.trim() === '';

  return (
    <Modal title={title} onClose={onClose} initialFocusRef={searchRef} fillBody>
      <div className={styles.picker}>
        <input
          ref={searchRef}
          className={styles.search}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <div className={styles.results}>
          {customLeads && customRow}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled === true}
              className={[
                styles.row,
                item.id === currentId ? styles.cur : '',
                item.disabled === true ? styles.disabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPick(item)}
            >
              <span className={styles.name}>{item.name}</span>
              {(item.tag !== undefined || item.hint !== undefined) && (
                <span className={styles.tags}>
                  {item.tag !== undefined && <span className={styles.tag}>{item.tag}</span>}
                  {item.hint !== undefined && <span className={styles.hint}>{item.hint}</span>}
                </span>
              )}
            </button>
          ))}
          {items.length === 0 && <div className={styles.empty}>{emptyLabel}</div>}
          {!customLeads && customRow}
        </div>
      </div>
    </Modal>
  );
}
