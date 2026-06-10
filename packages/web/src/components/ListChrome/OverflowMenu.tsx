import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import styles from './list-chrome.module.css';

// Shared mobile "⋯" overflow control (mobile-responsive S5, overlay taxonomy spec §0.2:
// a small menu is a bottom sheet). Holds a screen's secondary, full-width actions (e.g.
// Export CSV) that don't earn a permanent toolbar slot on a phone. A "⋯" button opens a
// Modal mobile="sheet" of action rows; running an action closes the sheet. Generic.

export interface OverflowAction {
  label: string;
  onClick: () => void;
}

interface OverflowMenuProps {
  actions: OverflowAction[];
  /** Button aria-label + sheet title; defaults to the shared "more actions" label. */
  label?: string;
}

export function OverflowMenu({ actions, label }: OverflowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const aria = label ?? t('list.more');

  if (actions.length === 0) return null;

  const run = (fn: () => void): void => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.toolBtn} ${styles.moreBtn}`}
        aria-label={aria}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>
      {open && (
        <Modal mobile="sheet" title={aria} onClose={() => setOpen(false)}>
          <div className={styles.sheetBody} role="menu">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                className={styles.sheetItem}
                onClick={() => run(a.onClick)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
