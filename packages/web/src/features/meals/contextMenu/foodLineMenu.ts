import type { Meal, MealEntry } from '@macronome/shared';
import type { CtxItem, CtxZoneResult } from '../../../components/ContextMenu/menu-types';

// Pure item builder for the Repas food-line context menu (B-195,
// design/components/context-menu.md). Mirrors the line's existing affordances — every
// onSelect calls an existing meal action; nothing is computed here. Owner-approved lists:
// referenced persisted → qty · zero qty · change food · move ▸ · pin/unpin · delete; custom
// persisted → edit · zero qty · move ▸ · delete; scaffold pre-fill (empty id — nothing
// persisted to move/pin/delete/zero, and the qty focus is id-keyed) → change food only; empty
// row → add here · manual values, then the generic block.

export interface FoodLineMenuCtx {
  mealId: string;
  mealIndex: number;
  row: number;
  /** The line at that row, or null for an empty "+ aliment" row. */
  entry: MealEntry | null;
  meals: Pick<Meal, 'id' | 'slot_name'>[];
  t: (key: string) => string;
  actions: {
    focusQty: (entryId: string) => void;
    /** Same call the qty cell and the mobile sheet make; used here to zero the line (B-249). */
    setQty: (
      mealId: string,
      mealIndex: number,
      entry: MealEntry,
      qty: number,
      unit: MealEntry['unit'],
      portionId?: string | null,
    ) => unknown;
    startEdit: (mealId: string, mealIndex: number, entryId: string | null, row?: number) => void;
    openCustom: (mealId: string, mealIndex: number, entryId: string | null, row?: number) => void;
    togglePin: (mealId: string, id: string, pinned: boolean) => unknown;
    deleteEntry: (mealId: string, id: string) => unknown;
    moveEntry: (sourceMealId: string, entryId: string, targetMealId: string) => unknown;
  };
}

/** "Remettre a zero" (B-249): zero the served quantity, keeping the line, its food, its unit and
 *  its pin - quantity 0 is already a designed state (`.zero` mutes the row, B-107). Rendered
 *  disabled rather than dropped when already 0, so the items below never shift. No confirmation:
 *  line edits are undoable (UR-1/B-133). */
function zeroQtyItem(c: FoodLineMenuCtx, entry: MealEntry): CtxItem {
  return {
    key: 'zeroQty',
    label: c.t('contextMenu.zeroQty'),
    disabled: entry.served_quantity === 0,
    onSelect: () =>
      void c.actions.setQty(c.mealId, c.mealIndex, entry, 0, entry.unit, entry.portion_id),
  };
}

export function buildFoodLineItems(c: FoodLineMenuCtx): CtxZoneResult {
  const { entry, mealId, mealIndex, row, meals, t, actions } = c;
  if (!entry) {
    return {
      appendGeneric: true,
      items: [
        {
          key: 'add',
          label: t('contextMenu.addFoodHere'),
          onSelect: () => actions.startEdit(mealId, mealIndex, null, row),
        },
        {
          key: 'manual',
          label: t('contextMenu.manualValues'),
          onSelect: () => actions.openCustom(mealId, mealIndex, null, row),
        },
      ],
    };
  }

  const isCustom = entry.kind === 'custom';
  // Mirrors FoodLine's openEdit: referenced → picker, custom → the custom-values modal.
  const changeFood: CtxItem = isCustom
    ? {
        key: 'edit',
        label: t('contextMenu.edit'),
        onSelect: () => actions.openCustom(mealId, mealIndex, entry.id),
      }
    : {
        key: 'changeFood',
        label: t('contextMenu.changeFood'),
        onSelect: () => actions.startEdit(mealId, mealIndex, entry.id),
      };
  if (!entry.id) return { items: [changeFood] };

  const zeroQty = zeroQtyItem(c, entry);
  const others = meals.filter((m) => m.id !== mealId);
  const moveTo: CtxItem[] =
    others.length === 0
      ? []
      : [
          {
            key: 'moveTo',
            label: t('contextMenu.moveTo'),
            children: others.map((m) => ({
              key: m.id,
              label: m.slot_name,
              onSelect: () => void actions.moveEntry(mealId, entry.id, m.id),
            })),
          },
        ];
  const head: CtxItem[] = isCustom
    ? [changeFood, zeroQty, ...moveTo]
    : [
        {
          key: 'qty',
          label: t('contextMenu.editQty'),
          onSelect: () => actions.focusQty(entry.id),
        },
        zeroQty,
        changeFood,
        ...moveTo,
        {
          key: 'pin',
          label: t(entry.is_pinned ? 'contextMenu.unpin' : 'contextMenu.pin'),
          onSelect: () => void actions.togglePin(mealId, entry.id, entry.is_pinned),
        },
      ];
  return {
    items: [
      ...head,
      {
        key: 'delete',
        label: t('common.remove'),
        danger: true,
        onSelect: () => void actions.deleteEntry(mealId, entry.id),
      },
    ],
  };
}
