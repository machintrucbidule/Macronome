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

// Mount-order stack so a nested sub-dialog (e.g. the macro-label paste dialog over the
// food modal) gets Escape, not the modal beneath it — without it both close at once.
const modalStack: string[] = [];

export function Modal({ title, size = 'md', onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(panelRef);

  useEffect(() => {
    modalStack.push(titleId);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === titleId) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = modalStack.lastIndexOf(titleId);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, [titleId]);

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
