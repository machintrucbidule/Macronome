import type { Meal, MealEntry } from '@macronome/shared';
import type { CtxItem, CtxZoneResult } from '../../../components/ContextMenu/menu-types';

// Pure item builder for the Repas food-line context menu (B-195,
// design/components/context-menu.md). Mirrors the line's existing affordances — every
// onSelect calls an existing meal action; nothing is computed here. Owner-approved lists:
// referenced persisted → qty · change food · move ▸ · pin/unpin · delete; custom persisted
// → edit · move ▸ · delete; scaffold pre-fill (empty id — nothing persisted to move/pin/
// delete, and the qty focus is id-keyed) → change food only; empty row → add here ·
// manual values, then the generic block.

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
    startEdit: (mealId: string, mealIndex: number, entryId: string | null, row?: number) => void;
    openCustom: (mealId: string, mealIndex: number, entryId: string | null, row?: number) => void;
    togglePin: (mealId: string, id: string, pinned: boolean) => unknown;
    deleteEntry: (mealId: string, id: string) => unknown;
    moveEntry: (sourceMealId: string, entryId: string, targetMealId: string) => unknown;
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
    ? [changeFood, ...moveTo]
    : [
        {
          key: 'qty',
          label: t('contextMenu.editQty'),
          onSelect: () => actions.focusQty(entry.id),
        },
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
