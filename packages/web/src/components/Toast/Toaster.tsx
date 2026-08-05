import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TOAST_MS,
  TOAST_UNDO_MS,
  consumePendingToast,
  dismissToast,
  getToast,
  showToast,
  subscribeToast,
} from './toast-store';
import styles from './toast.module.css';

// The single toast surface (B-261, design/components/toasts-warnings.md §E). Mounted once at the
// app root; everything it shows comes from `showToast`. One toast at a time — a new request
// replaces the current one, which is why the timer is keyed on the toast's id.
//
// `role="status"` + `aria-live="polite"`: announced once, never interrupting, and it never
// steals focus (it is a confirmation, not a dialog).

export function Toaster() {
  const { t } = useTranslation();
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null);
  // Hovering or focusing holds it open: an Annuler you are reaching for must not vanish.
  const [held, setHeld] = useState(false);
  const busy = useRef(false);

  const id = toast?.id;
  const hasUndo = toast?.undo !== undefined;

  // A confirmation handed across a reload (the data import reloads on success) — raised on mount
  // so the message the user is owed still reaches them.
  useEffect(() => {
    const pending = consumePendingToast();
    if (pending !== null) showToast({ message: pending });
  }, []);

  useEffect(() => {
    if (id === undefined || held) return;
    const timer = setTimeout(() => dismissToast(id), hasUndo ? TOAST_UNDO_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, held, hasUndo]);

  // A new toast arrives un-held even if the pointer never left the previous one's box.
  useEffect(() => setHeld(false), [id]);

  const runUndo = useCallback((): void => {
    const undo = toast?.undo;
    if (undo === undefined || busy.current) return;
    busy.current = true;
    // Dismiss first: the undo re-renders the screen underneath, and a lingering bubble over the
    // restored day reads as if it had not worked.
    dismissToast(toast?.id);
    void Promise.resolve(undo()).finally(() => {
      busy.current = false;
    });
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className={styles.message}>{toast.message}</span>
      {hasUndo && (
        <button type="button" className={styles.undo} onClick={runUndo}>
          {t('common.undo')}
        </button>
      )}
      <button
        type="button"
        className={styles.close}
        onClick={() => dismissToast(toast.id)}
        aria-label={t('toast.dismiss')}
      >
        ×
      </button>
    </div>
  );
}
