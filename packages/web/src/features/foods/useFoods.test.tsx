import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FoodListResponse } from '@macronome/shared';
import { foodsApi } from '../../api/foods';
import { useFoodsList } from './useFoods';

// LL-1/B-122: the foods list lazy-loads by keyset cursor. Page 1 carries a `next_cursor`;
// `fetchNextPage` loads page 2 with that cursor and appends; a null cursor ends the list.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function food(id: string): FoodListResponse['data'][number] {
  return { id, name: id } as never;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFoodsList — keyset lazy-loading (B-122)', () => {
  it('loads page 1, fetches & appends page 2 on demand, then stops at next_cursor=null', async () => {
    const listSpy = vi
      .spyOn(foodsApi, 'list')
      .mockResolvedValueOnce({ data: [food('a'), food('b')], next_cursor: 'c1' })
      .mockResolvedValueOnce({ data: [food('c'), food('d')], next_cursor: null });

    const { result } = renderHook(() => useFoodsList({ sort: 'name', dir: 'asc' }), { wrapper });

    // Page 1.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages.flatMap((p) => p.data).map((f) => f.id)).toEqual(['a', 'b']);
    expect(result.current.hasNextPage).toBe(true);
    expect(listSpy).toHaveBeenLastCalledWith({ sort: 'name', dir: 'asc' });

    // Page 2 appends and exhausts the list.
    void result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.pages.flatMap((p) => p.data).map((f) => f.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(listSpy).toHaveBeenLastCalledWith({ sort: 'name', dir: 'asc', cursor: 'c1' });
  });
});
