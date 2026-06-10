import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { MealEntry } from '@macronome/shared';

// Mobile-only touch drag-to-reorder for a meal's food lines (spec §5.3). Native HTML5 DnD
// (useLineDnd) does not fire on touch, so this adds a long-press pointer gesture on the grip:
// press-and-hold arms the drag, then the finger position hit-tests the line rows; release commits
// the new order through the SAME reorder action the desktop drag uses. Desktop is untouched — the
// handlers are only attached when `enabled` (the caller gates on useIsMobile()) and mouse pointers
// are ignored, so the native draggable path stays in charge there.

const LONG_PRESS_MS = 300;
const MOVE_CANCEL_PX = 10;

/** Pure reorder computation (mirrors useLineDnd.onDrop): move `dragId` from `fromRow` to `toRow`,
 *  swapping with any occupant so sparse rows are preserved. Returns null for a no-op (same row). */
export function computeOrder(
  dragId: string,
  fromRow: number,
  toRow: number,
  byRow: Map<number, MealEntry>,
): { id: string; order_index: number }[] | null {
  if (toRow === fromRow) return null;
  const occupant = byRow.get(toRow);
  return occupant && occupant.id !== dragId
    ? [
        { id: dragId, order_index: toRow },
        { id: occupant.id, order_index: fromRow },
      ]
    : [{ id: dragId, order_index: toRow }];
}

interface DragState {
  id: string;
  fromRow: number;
  toRow: number;
  startX: number;
  startY: number;
  active: boolean;
  timer: number;
}

/** Resolve the food-line row under a screen point via its `data-line-row` attribute. */
function rowFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-line-row]');
  const raw = el?.getAttribute('data-line-row');
  return raw == null ? null : Number(raw);
}

export interface TouchReorder {
  /** The entry id currently held (for the grabbed visual), or null. */
  grabbedId: string | null;
  /** Pointer handlers to spread on a line's grip; `{}` when disabled (desktop). */
  gripHandlers: (id: string, fromRow: number) => Partial<Record<string, (e: PointerEvent) => void>>;
}

export function useTouchReorder(
  enabled: boolean,
  byRow: Map<number, MealEntry>,
  reorder: (order: { id: string; order_index: number }[]) => void,
): TouchReorder {
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const state = useRef<DragState | null>(null);

  useEffect(
    () => () => {
      if (state.current) window.clearTimeout(state.current.timer);
    },
    [],
  );

  if (!enabled) return { grabbedId: null, gripHandlers: () => ({}) };

  const reset = (): void => {
    if (state.current) window.clearTimeout(state.current.timer);
    state.current = null;
    setGrabbedId(null);
  };

  const finish = (): void => {
    const st = state.current;
    state.current = null;
    setGrabbedId(null);
    if (!st) return;
    window.clearTimeout(st.timer);
    if (!st.active) return;
    const order = computeOrder(st.id, st.fromRow, st.toRow, byRow);
    if (order) reorder(order);
  };

  return {
    grabbedId,
    gripHandlers: (id, fromRow) => ({
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse') return; // desktop keeps native HTML5 DnD
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const timer = window.setTimeout(() => {
          if (state.current) {
            state.current.active = true;
            setGrabbedId(id);
          }
        }, LONG_PRESS_MS);
        state.current = {
          id,
          fromRow,
          toRow: fromRow,
          startX: e.clientX,
          startY: e.clientY,
          active: false,
          timer,
        };
      },
      onPointerMove: (e) => {
        const st = state.current;
        if (!st) return;
        if (!st.active) {
          // A move before the long-press fires = a scroll attempt → abandon the drag.
          if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) > MOVE_CANCEL_PX) reset();
          return;
        }
        e.preventDefault();
        const row = rowFromPoint(e.clientX, e.clientY);
        if (row !== null) st.toRow = row;
      },
      onPointerUp: finish,
      onPointerCancel: reset,
    }),
  };
}
