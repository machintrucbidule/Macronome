import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdSelection } from './useIdSelection';

// BE-1: the selection is a set of ids frozen against the filter it was made under. The rule that
// matters is when it must be dropped — a set that outlives its filter would write to rows the user
// can no longer see.

describe('useIdSelection (BE-1)', () => {
  it('toggles ids in and out', () => {
    const { result } = renderHook(() => useIdSelection('filter-a'));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);

    act(() => result.current.toggle('a'));
    expect(result.current.count).toBe(1);
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('replaces the whole set — what the header checkbox does with the ids it fetched', () => {
    const { result } = renderHook(() => useIdSelection('filter-a'));
    act(() => result.current.toggle('a'));
    act(() => result.current.setAll(['x', 'y', 'z']));
    expect(result.current.count).toBe(3);
    expect(result.current.isSelected('a')).toBe(false);

    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it('drops the selection when the filter changes', () => {
    const { result, rerender } = renderHook(({ key }) => useIdSelection(key), {
      initialProps: { key: 'filter-a' },
    });
    act(() => result.current.setAll(['x', 'y']));
    expect(result.current.count).toBe(2);

    rerender({ key: 'filter-b' });
    expect(result.current.count).toBe(0);
  });

  it('keeps it when nothing about the filter changed', () => {
    // The sort is deliberately not part of the key: re-ordering the same rows selects the same set.
    const { result, rerender } = renderHook(({ key }) => useIdSelection(key), {
      initialProps: { key: 'filter-a' },
    });
    act(() => result.current.setAll(['x', 'y']));
    rerender({ key: 'filter-a' });
    expect(result.current.count).toBe(2);
  });
});
