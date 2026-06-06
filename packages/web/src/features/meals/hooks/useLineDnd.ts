import { useState } from 'react';
import type { MealEntry } from '@macronome/shared';

// Drag-to-reorder state for a meal's lines (B-029). Native HTML5 DnD: the grip starts a
// drag from a row; dropping on another row moves the dragged line to that row (swapping
// with any occupant), so positions/gaps are addressable and preserved. The actual persist
// goes through the reorder action (one PATCH .../entries/order).
export interface LineDnd {
  dragId: string | null;
  onDragStart: (id: string, row: number) => void;
  onDragEnd: () => void;
  onDrop: (row: number) => void;
}

export function useLineDnd(
  mealId: string,
  byRow: Map<number, MealEntry>,
  reorder: (mealId: string, order: { id: string; order_index: number }[]) => void,
): LineDnd {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const reset = (): void => {
    setDragId(null);
    setDragFrom(null);
  };

  return {
    dragId,
    onDragStart: (id, row) => {
      setDragId(id);
      setDragFrom(row);
    },
    onDragEnd: reset,
    onDrop: (row) => {
      if (dragId === null || dragFrom === null || row === dragFrom) {
        reset();
        return;
      }
      const occupant = byRow.get(row);
      const order =
        occupant && occupant.id !== dragId
          ? [
              { id: dragId, order_index: row },
              { id: occupant.id, order_index: dragFrom },
            ]
          : [{ id: dragId, order_index: row }];
      reorder(mealId, order);
      reset();
    },
  };
}
