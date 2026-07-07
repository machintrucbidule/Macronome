import { useTranslation } from 'react-i18next';
import { useContextMenuZone } from '../../../components/ContextMenu/ContextMenuContext';
import type { MealsController } from '../hooks/useMealsController';
import { buildFoodLineItems } from './foodLineMenu';

// Repas zone resolver for the installed-window context menu (B-195): a right-clicked
// line is identified by the FoodLine row attributes (`data-line-row` on entry rows,
// `data-ctx-row` on empty rows — separate so the mobile long-press hit-test stays
// entry-rows-only) inside a MealColumn's `data-ctx-meal` root. Anything else on the
// screen falls through to the generic menu.
export function useMealsContextMenu(ctl: MealsController): void {
  const { t } = useTranslation();
  useContextMenuZone((target) => {
    const rowEl = target.closest<HTMLElement>('[data-line-row], [data-ctx-row]');
    const mealEl = target.closest<HTMLElement>('[data-ctx-meal]');
    if (!rowEl || !mealEl) return null;
    const row = Number(rowEl.getAttribute('data-line-row') ?? rowEl.getAttribute('data-ctx-row'));
    const mealId = mealEl.getAttribute('data-ctx-meal') ?? '';
    const mealIndex = Number(mealEl.getAttribute('data-ctx-meal-index'));
    if (!mealId || Number.isNaN(row) || Number.isNaN(mealIndex)) return null;
    const meals = ctl.day?.meals ?? [];
    const meal = meals.find((m) => m.order_index === mealIndex);
    const entry = meal?.entries.find((e) => e.order_index === row) ?? null;
    return buildFoodLineItems({ mealId, mealIndex, row, entry, meals, t, actions: ctl.actions });
  });
}
