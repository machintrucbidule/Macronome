import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import styles from './list-chrome.module.css';

// Shared mobile "Trier" control (mobile-responsive S5, overlay taxonomy spec §0.2: a sort
// picker is a bottom sheet). A toolbar button opening a Modal mobile="sheet" that lists the
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
}

export function SortSheet<K extends string>({
  options,
  sort,
  dir,
  onSort,
  label,
}: SortSheetProps<K>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = label ?? t('list.sort');
  const dirLabel = t(dir === 'asc' ? 'list.sortAsc' : 'list.sortDesc');

  return (
    <>
      <button type="button" className={styles.toolBtn} onClick={() => setOpen(true)}>
        <span aria-hidden="true">⇅</span>
        {title}
      </button>
      {open && (
        <Modal mobile="sheet" title={title} onClose={() => setOpen(false)}>
          <div className={styles.sheetBody} role="menu">
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
