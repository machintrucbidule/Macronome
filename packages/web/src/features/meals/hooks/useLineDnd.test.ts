import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { MealEntry } from '@macronome/shared';
import { useLineDnd, type DragSource } from './useLineDnd';

// Within-meal drag reorder (B-029) + cross-meal move via the shared day-level drag ref
// (B-187): a drop in another column moves the line there — empty row = exact landing,
// occupied row = append (order_index omitted; never a cross-meal swap).
const entry = (id: string): MealEntry => ({ id }) as MealEntry;
type DragRef = MutableRefObject<DragSource | null>;

function setup(mealId: string, rows: [number, MealEntry][], drag: DragRef) {
  const reorder = vi.fn();
  const move = vi.fn();
  const { result } = renderHook(() => useLineDnd(mealId, new Map(rows), reorder, drag, move));
  return { result, reorder, move };
}

describe('useLineDnd', () => {
  it('still swaps within the meal (B-029 unchanged) and clears the shared ref', () => {
    const drag: DragRef = { current: null };
    const { result, reorder, move } = setup(
      'm1',
      [
        [0, entry('a')],
        [1, entry('b')],
      ],
      drag,
    );
    act(() => result.current.onDragStart('a', 0));
    expect(drag.current).toEqual({ entryId: 'a', mealId: 'm1' });
    act(() => result.current.onDrop(1));
    expect(reorder).toHaveBeenCalledWith('m1', [
      { id: 'a', order_index: 1 },
      { id: 'b', order_index: 0 },
    ]);
    expect(move).not.toHaveBeenCalled();
    expect(drag.current).toBeNull();
  });

  it('cross-meal drop on an empty row moves the line to that exact row', () => {
    const drag: DragRef = { current: null };
    const source = setup('m1', [[0, entry('a')]], drag);
    const target = setup('m2', [[5, entry('z')]], drag);

    act(() => source.result.current.onDragStart('a', 0));
    act(() => target.result.current.onDrop(2)); // row 2 is empty in m2

    expect(target.move).toHaveBeenCalledWith('a', 'm1', 'm2', 2);
    expect(target.reorder).not.toHaveBeenCalled();
    expect(drag.current).toBeNull();
  });

  it('cross-meal drop on an occupied row appends (order omitted — no cross-meal swap)', () => {
    const drag: DragRef = { current: null };
    const source = setup('m1', [[0, entry('a')]], drag);
    const target = setup('m2', [[5, entry('z')]], drag);

    act(() => source.result.current.onDragStart('a', 0));
    act(() => target.result.current.onDrop(5)); // row 5 is occupied by z

    expect(target.move).toHaveBeenCalledWith('a', 'm1', 'm2', undefined);
    expect(target.reorder).not.toHaveBeenCalled();
  });

  it('drag end clears the ref; a drop with no active drag is a no-op', () => {
    const drag: DragRef = { current: null };
    const { result, reorder, move } = setup('m1', [[0, entry('a')]], drag);
    act(() => result.current.onDragStart('a', 0));
    act(() => result.current.onDragEnd());
    expect(drag.current).toBeNull();
    act(() => result.current.onDrop(2));
    expect(reorder).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
  });
});
