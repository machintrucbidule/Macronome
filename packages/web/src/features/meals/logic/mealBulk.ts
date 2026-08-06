import type { Meal } from '@macronome/shared';

// Would the ⋯ menu's two bulk actions (MC-1 / B-296) change anything? They are rendered DISABLED
// rather than dropped when they would not, so the entries below never shift under the pointer —
// the same rule as the line-level "Remettre à zéro" (B-249). Pure predicates, mirroring what the
// server would compute, so the menu never offers a call that writes nothing.
//
// `is_pinned` is the DISPLAY pin the server already derives (the line's own flag AND a live
// garde-manger entry for that slot), which is exactly the line a delete keeps at 0 (D1) — so the
// client needs no pantry knowledge of its own.

/** *Supprimer tous les aliments*: anything to delete, any pinned line still carrying a quantity
 *  to reset, or any leftover group to dissolve. */
export function canClearMealLines(meal: Meal): boolean {
  if (meal.leftover_groups.length > 0) return true;
  return meal.entries.some((e) => !e.is_pinned || e.served_quantity > 0);
}

/** *Tout remettre à zéro*: any quantity above 0, or a leftover group that would go with it. */
export function canZeroMealLines(meal: Meal): boolean {
  if (meal.leftover_groups.length > 0) return true;
  return meal.entries.some((e) => e.served_quantity > 0);
}
