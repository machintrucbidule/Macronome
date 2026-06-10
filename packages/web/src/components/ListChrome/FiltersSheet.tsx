import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import { Chip } from '../Form/Chip';
import chrome from './list-chrome.module.css';
import styles from './filters-sheet.module.css';

// Shared mobile "Filtres" control — the multi-control member of the list-chrome filter family
// (mobile-responsive S6, spec §4.1, overlay taxonomy §0.2: a filter is a bottom sheet). Where
// the sibling FilterSheet (S5) is a single-select sheet (e.g. Journal month), FiltersSheet
// stacks several filter sections in one Modal mobile="sheet": a single-select chip group
// ('chips') and/or a boolean 'toggle'. Created with its first consumer (Recettes min-rating +
// show-archived), consumed read-only by Aliments (S7). An icon-only funnel button (reusing the
// chrome toolBtn styling) opens the sheet; the button reads as active (accent) when `active` is
// true. The sheet holds several controls, so selecting keeps it open — it closes via the Modal.

export type FilterSection =
  | {
      kind: 'chips';
      label: string;
      options: { key: string; label: string }[];
      value: string;
      onChange: (key: string) => void;
    }
  | {
      kind: 'toggle';
      label: string;
      checked: boolean;
      onChange: (checked: boolean) => void;
    };

interface FiltersSheetProps {
  sections: FilterSection[];
  /** Whether any non-default filter is applied (drives the button's accent state). */
  active: boolean;
  /** Button aria-label + sheet title; defaults to the shared "Filtrer" label. */
  label?: string;
}

export function FiltersSheet({ sections, active, label }: FiltersSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = label ?? t('list.filter');

  return (
    <>
      <button
        type="button"
        className={`${chrome.toolBtn} ${active ? chrome.toolBtnActive : ''}`}
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
        <Modal mobile="sheet" title={title} onClose={() => setOpen(false)}>
          <div className={styles.body}>
            {sections.map((section) =>
              section.kind === 'chips' ? (
                <div key={section.label} className={styles.section}>
                  <h4 className={styles.sectionLabel}>{section.label}</h4>
                  <div className={styles.chipRow}>
                    {section.options.map((o) => (
                      <Chip
                        key={o.key}
                        pressed={o.key === section.value}
                        onClick={() => section.onChange(o.key)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : (
                <label key={section.label} className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={section.checked}
                    onChange={(e) => section.onChange(e.target.checked)}
                  />
                  <span>{section.label}</span>
                </label>
              ),
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
