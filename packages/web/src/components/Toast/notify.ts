import i18n from '../../i18n/config';
import { showToast } from './toast-store';

// One-line confirmation helpers over the neutral toast store (B-261). Keeping the i18n lookup
// here means a call site is a single line, which is what makes it realistic to cover EVERY
// explicit action instead of the handful that first shipped.
//
// Scope rule (design/components/toasts-warnings.md §E): a toast is for an action whose result is
// off-screen or invisible. Creating or editing a row that then appears in the list under the
// user's eyes gets none — the list IS the feedback.

/** Confirm a completed action. `toast.<key>` must exist in both locales. */
export function notify(key: string): void {
  showToast({ message: i18n.t(`toast.${key}`) });
}

/**
 * Confirm a completed action and offer Annuler.
 *
 * The undo may legitimately fail — a re-created weigh-in, container or meal slot collides on its
 * unique key if the freed slot was retaken meanwhile, and a day restore point is consumed by the
 * next destructive action. Saying so is the point: silently swallowing it would leave the user
 * believing their data came back.
 */
export function notifyUndoable(key: string, undo: () => Promise<unknown>): void {
  showToast({
    message: i18n.t(`toast.${key}`),
    undo: async () => {
      try {
        await undo();
      } catch {
        notify('undoFailed');
      }
    },
  });
}
