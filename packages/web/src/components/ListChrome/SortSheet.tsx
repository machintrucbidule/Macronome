import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import styles from './list-chrome.module.css';

// Shared mobile "Trier" control (mobile-responsive S5, overlay taxonomy spec §0.2: a sort
// picker is a bottom sheet). A toolbar button opening a bottom-sheet Modal that lists the
// screen's sort keys + the active direction — the phone equivalent of the desktop sortable
// column headers. Selecting a key calls `onSort(key)`, which (like clicking a SortableTh)
// switches the key or toggles the direction when the active key is tapped again; the sheet
// stays open so the direction flip is visible. Generic over the screen's sort-field union.

export interface SortOption<K extends string> {
  key: K;
  label: string;
}

interface SortSheetProps<K extends string> {
  options: SortOption<K>[];
  sort: K;
  dir: 'asc' | 'desc';
  onSort: (key: K) => void;
  /** Button + sheet title; defaults to the shared "Trier" label. */
  label?: string;
  /** Pad the sheet bottom so a floating "+" FAB doesn't overlap the last row (FAB screens). */
  fabSafe?: boolean;
}

export function SortSheet<K extends string>({
  options,
  sort,
  dir,
  onSort,
  label,
  fabSafe,
}: SortSheetProps<K>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = label ?? t('list.sort');
  const dirLabel = t(dir === 'asc' ? 'list.sortAsc' : 'list.sortDesc');

  return (
    <>
      <button
        type="button"
        className={styles.toolBtn}
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 5v14M7 5 4 8M7 5l3 3" />
          <path d="M17 19V5M17 19l-3-3M17 19l3-3" />
        </svg>
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className={`${styles.sheetBody} ${fabSafe ? styles.fabSafe : ''}`} role="menu">
            {options.map((o) => {
              const active = o.key === sort;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={`${styles.sheetItem} ${active ? styles.sheetItemActive : ''}`}
                  onClick={() => onSort(o.key)}
                >
                  <span>{o.label}</span>
                  {active && (
                    <span className={styles.dir} aria-label={dirLabel}>
                      {dir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
