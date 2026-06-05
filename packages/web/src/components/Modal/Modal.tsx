import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';
import { useFocusTrap } from './useFocusTrap';

// Shared modal shell (design/components/modals.md): scrim + panel. Click-outside and
// Escape close non-destructive modals. Feature modals (food add/edit, archive
// confirm) compose this shell with their own body + actions.
interface ModalProps {
  title: ReactNode;
  size?: 'md' | 'confirm' | 'wide';
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, size = 'md', onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.modal} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div id={titleId} className={styles.header}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export { styles as modalStyles };
