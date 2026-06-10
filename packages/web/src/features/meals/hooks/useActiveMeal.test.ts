import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActiveMeal } from './useActiveMeal';

// useActiveMeal() carries the two spec §5.3 rules (reset-on-day-change, clamp-to-count) — that
// is logic, so it is unit-tested. The tab bar's layout itself is verified by inspection.

describe('useActiveMeal', () => {
  it('starts on the first meal', () => {
    const { result } = renderHook(() => useActiveMeal('2026-06-10', 3));
    expect(result.current[0]).toBe(0);
  });

  it('selects a meal and reports it', () => {
    const { result } = renderHook(() => useActiveMeal('2026-06-10', 3));
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
  });

  it('resets to the first meal when the day changes', () => {
    const { result, rerender } = renderHook(({ date }) => useActiveMeal(date, 3), {
      initialProps: { date: '2026-06-10' },
    });
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);

    rerender({ date: '2026-06-11' });
    expect(result.current[0]).toBe(0);
  });

  it('clamps the active index when the meal count shrinks', () => {
    const { result, rerender } = renderHook(({ count }) => useActiveMeal('2026-06-10', count), {
      initialProps: { count: 3 },
    });
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);

    // A meal was deleted: the active index must fall back into range, not dangle past the end.
    rerender({ count: 2 });
    expect(result.current[0]).toBe(1);
  });

  it('reports the first meal when there are no meals', () => {
    const { result } = renderHook(() => useActiveMeal('2026-06-10', 0));
    expect(result.current[0]).toBe(0);
  });
});
