import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import styles from './list-chrome.module.css';

// Shared mobile "Filtrer" control (mobile-responsive S5, overlay taxonomy spec §0.2: a filter
// is a bottom sheet). An icon-only toolbar button (funnel) opening a bottom-sheet Modal that
// lists single-select options; the first option is the "all / no filter" reset. Selecting an
// option calls onSelect and closes. The button reads as **active** (accent) when a non-default
// option is applied. Generic single-select; first consumer is the Journal month filter, reused
// read-only by later list screens. (Multi-control filters, e.g. Recettes min-rating + archived,
// extend this family in S6.)

export interface FilterOption {
  /** '' is the conventional "all / no filter" key. */
  key: string;
  label: string;
}

interface FilterSheetProps {
  options: FilterOption[];
  value: string;
  onSelect: (key: string) => void;
  /** Button aria-label + sheet title; defaults to the shared "Filtrer" label. */
  label?: string;
}

export function FilterSheet({ options, value, onSelect, label }: FilterSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = label ?? t('list.filter');
  const active = value !== '';

  const choose = (key: string): void => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
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
          <path d="M4 6h16l-6 7v5l-4-2v-4z" />
        </svg>
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className={styles.sheetBody} role="menu">
            {options.map((o) => {
              const selected = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`${styles.sheetItem} ${selected ? styles.sheetItemActive : ''}`}
                  onClick={() => choose(o.key)}
                >
                  <span>{o.label}</span>
                  {selected && (
                    <span className={styles.dir} aria-hidden="true">
                      ✓
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
