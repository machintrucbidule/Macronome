import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Modal.module.css';
import { useFocusTrap } from './useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from './bodyScrollLock';
import { useIsMobile } from '../../lib/useIsMobile';

// Shared modal shell (design/components/modals.md): scrim + panel. Click-outside and
// Escape close non-destructive modals. Feature modals (food add/edit, archive
// confirm) compose this shell with their own body + actions.
//
// On the phone breakpoint (≤560px, overlay taxonomy MS-1) every modal renders as a **bottom
// sheet** — a single mobile overlay language (the `fullscreen` and centered-on-mobile variants
// were retired). The sheet styling is selected by `useIsMobile()` and inert ≥561px, so desktop
// is unchanged. `size` still controls the desktop width.
interface ModalProps {
  title: ReactNode;
  size?: 'md' | 'confirm' | 'wide';
  /**
   * Optional control rendered in the mobile top bar, between the title and the close "×"
   * (e.g. the theme toggle in the account sheet). Only shown on mobile (the sheet's top bar);
   * omitted → the bar is exactly title + close. No effect on desktop.
   */
  headerAction?: ReactNode;
  /**
   * Optional initial-focus target (B-206). Search overlays pass a ref to their input so the focus
   * trap lands focus on it (keyboard opens) instead of the header "×". Omitted → default
   * first-focusable behaviour, unchanged for every other modal.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Optional (B-206): make the mobile sheet a flex column whose body owns the scroll — the sheet's
   * direct child stays pinned at the top and its inner list scrolls. Used by the keyboard-aware
   * search sheets. Off by default (desktop + non-search modals unchanged).
   */
  fillBody?: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Mount-order stack so a nested sub-dialog (e.g. the macro-label paste dialog over the
// food modal) gets Escape, not the modal beneath it — without it both close at once.
const modalStack: string[] = [];

export function Modal({
  title,
  size = 'md',
  headerAction,
  initialFocusRef,
  fillBody = false,
  onClose,
  children,
}: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(panelRef, initialFocusRef);
  // On mobile every modal is a bottom sheet (MS-1); ≥561px `variant` is undefined → no extra
  // class, no close button → desktop markup unchanged.
  const isMobile = useIsMobile();
  const variant = isMobile ? 'sheet' : undefined;
  // fillBody only affects the mobile sheet (the panel becomes a flex column with an inner scroll);
  // ≥561px it is inert so desktop layout is unchanged.
  const fillClass = fillBody && variant ? styles.fill : '';

  useEffect(() => {
    modalStack.push(titleId);
    lockBodyScroll();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === titleId) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
      const i = modalStack.lastIndexOf(titleId);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, [titleId]);

  const scrimVariant = variant === 'sheet' ? styles.scrimSheet : '';
  // Portal to <body> so the scrim escapes any ancestor stacking context (e.g. the sticky day bar's
  // z-index, which otherwise traps a sheet *under* the Repas meal-tabs bar). The scrim's own
  // z-index then wins against page chrome, so sheets render over the meal selector.
  return createPortal(
    <div
      className={`${styles.scrim} ${scrimVariant}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.modal} ${styles[size]} ${variant ? styles[variant] : ''} ${fillClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div id={titleId} className={`${styles.header} ${variant ? styles.headerBar : ''}`}>
          {variant ? <span className={styles.headerTitle}>{title}</span> : title}
          {variant && (
            <div className={styles.headerActions}>
              {headerAction}
              <button
                type="button"
                className={styles.close}
                aria-label={t('common.close')}
                onClick={onClose}
              >
                ×
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export { styles as modalStyles };
