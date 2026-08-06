import type { ClearMealRequest } from '@macronome/shared';
import { toastDayAction } from './dayToasts';
import type { MealActionDeps, ResolveMealId, Run } from './mealActions';

// The two per-meal bulk actions of the ⋯ menu (MC-1 / B-296): empty the meal, or reset every
// quantity to 0. Split out of mealActions.ts, which is at its size cap.
//
// They are the ONLY destructive actions in the app with no confirmation dialog (owner decision,
// design/components/modals.md §Conditional confirmation, second exception): they apply straight
// away and the toast's Annuler is the safety net, replaying the server-side day restore point the
// endpoint captured. `resetHistory` follows because a day-level write invalidates the client's
// line-level undo stack — the same pairing as Tout effacer.

export function mealBulkActions(d: MealActionDeps, run: Run, resolveMealId: ResolveMealId) {
  // The slot may still be a scaffold, so the id is resolved (which materializes) exactly like
  // every other meal action — even though the menu entries are disabled on an empty meal.
  const clear = (mealId: string, mealIndex: number, mode: ClearMealRequest['mode']) =>
    run(
      (async () => {
        const id = await resolveMealId(mealId, mealIndex);
        await d.day.clearMeal.mutateAsync({ mealId: id, mode });
        toastDayAction(
          d.day,
          mode === 'delete' ? 'mealCleared' : 'mealZeroed',
          d.resetHistory ?? (() => undefined),
        );
      })(),
    );

  return {
    /** Supprimer tous les aliments — keeps the 📌 garde-manger lines at qty 0 (D1). */
    clearMealLines: (mealId: string, mealIndex: number) => clear(mealId, mealIndex, 'delete'),
    /** Tout remettre à zéro — keeps every line, sets each quantity to 0. */
    zeroMealLines: (mealId: string, mealIndex: number) => clear(mealId, mealIndex, 'zero'),
  };
}
