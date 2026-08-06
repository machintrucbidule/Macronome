import i18n from '../../../i18n/config';
import { showToast } from '../../../components/Toast/toast-store';
import type { UseDay } from './useDay';

// Confirmations for the Repas actions (B-261). The toast provider itself is neutral, so the
// meal-specific knowledge — which message, and what "Annuler" actually does — lives here.
//
// Two undo mechanisms, deliberately kept apart:
//  · line edits replay through the existing client history stack (UR-1/B-133);
//  · the destructive DAY actions — and the two per-meal bulk actions (MC-1/B-296), which write
//    the same day-scoped restore point — replay a SERVER restore point, because a browser-side
//    replay cannot bring leftovers back (the frozen group carries the container's name and tare,
//    never its id). That is the whole reason `POST /days/:date/undo` exists.
//
// The toast is the only affordance (owner decision): once it is gone the action is no longer
// reversible from the UI, so nothing here persists beyond it.

/** Confirm a destructive day action, offering the server-side undo. `resetHistory` drops the
 *  line-level stack afterwards: the replay re-creates every line with fresh ids. */
export function toastDayAction(
  day: UseDay,
  key: 'dayCleared' | 'dayCopied' | 'mealDeleted' | 'mealCleared' | 'mealZeroed',
  resetHistory: () => void,
): void {
  showToast({
    message: i18n.t(`toast.${key}`),
    undo: async () => {
      try {
        await day.undoDay.mutateAsync();
        resetHistory();
      } catch {
        // 409 nothing_to_undo — another destructive action consumed the point meanwhile. Say so
        // rather than leaving the user believing the day came back.
        showToast({ message: i18n.t('toast.undoFailed') });
      }
    },
  });
}

/** Confirm a deleted meal line, offering the client-side history undo. */
export function toastLineDeleted(undo: () => void): void {
  showToast({ message: i18n.t('toast.lineDeleted'), undo });
}
