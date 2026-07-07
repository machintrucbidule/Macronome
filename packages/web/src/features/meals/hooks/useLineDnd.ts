import { useState, type MutableRefObject } from 'react';
import type { MealEntry } from '@macronome/shared';

// Drag-to-reorder state for a meal's lines (B-029). Native HTML5 DnD: the grip starts a
// drag from a row; dropping on another row moves the dragged line to that row (swapping
// with any occupant), so positions/gaps are addressable and preserved. The actual persist
// goes through the reorder action (one PATCH .../entries/order).
// Cross-meal move (B-187): the shared day-level `drag` ref carries the source across
// columns (each column has its own hook). A drop in another meal's column moves the line
// there — an empty row lands exactly at it, an occupied row appends after the target's
// last filled line (order_index omitted; never a cross-meal swap).
export interface DragSource {
  entryId: string;
  mealId: string;
}

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
  drag?: MutableRefObject<DragSource | null>,
  move?: (entryId: string, sourceMealId: string, targetMealId: string, orderIndex?: number) => void,
): LineDnd {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const reset = (): void => {
    setDragId(null);
    setDragFrom(null);
    if (drag) drag.current = null;
  };

  return {
    dragId,
    onDragStart: (id, row) => {
      setDragId(id);
      setDragFrom(row);
      if (drag) drag.current = { entryId: id, mealId };
    },
    onDragEnd: reset,
    onDrop: (row) => {
      // Cross-meal drop (B-187): the drag started in another column (this hook has no
      // local drag state) — the shared ref identifies the line to move here.
      const source = drag?.current;
      if (source && source.mealId !== mealId && move) {
        move(source.entryId, source.mealId, mealId, byRow.get(row) ? undefined : row);
        reset();
        return;
      }
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
