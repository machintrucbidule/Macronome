import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Modal.module.css';
import { useFocusTrap } from './useFocusTrap';
import { useIsMobile } from '../../lib/useIsMobile';

// Shared modal shell (design/components/modals.md): scrim + panel. Click-outside and
// Escape close non-destructive modals. Feature modals (food add/edit, archive
// confirm) compose this shell with their own body + actions.
//
// `mobile` declares a ≤560px presentation (overlay taxonomy, spec §0.2) that overrides the
// centered `size` width on phones only: `fullscreen` (100vw×100dvh takeover) or `sheet`
// (bottom-anchored). It is selected by `useIsMobile()` and inert ≥561px, so desktop is
// unchanged. `size` still controls the desktop width regardless of `mobile`.
interface ModalProps {
  title: ReactNode;
  size?: 'md' | 'confirm' | 'wide';
  mobile?: 'fullscreen' | 'sheet';
  onClose: () => void;
  children: ReactNode;
}

// Mount-order stack so a nested sub-dialog (e.g. the macro-label paste dialog over the
// food modal) gets Escape, not the modal beneath it — without it both close at once.
const modalStack: string[] = [];

export function Modal({ title, size = 'md', mobile, onClose, children }: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(panelRef);
  // Mobile presentation is only active on the phone breakpoint; ≥561px `variant` is
  // undefined → no extra class, no close button → desktop markup unchanged.
  const isMobile = useIsMobile();
  const variant = isMobile ? mobile : undefined;

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

  const scrimVariant =
    variant === 'fullscreen' ? styles.scrimFull : variant === 'sheet' ? styles.scrimSheet : '';
  return (
    <div
      className={`${styles.scrim} ${scrimVariant}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.modal} ${styles[size]} ${variant ? styles[variant] : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div id={titleId} className={`${styles.header} ${variant ? styles.headerBar : ''}`}>
          {title}
          {variant && (
            <button
              type="button"
              className={styles.close}
              aria-label={t('common.close')}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export { styles as modalStyles };
