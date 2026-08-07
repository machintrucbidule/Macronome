import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FoodListResponse } from '@macronome/shared';
import { foodsApi } from '../../api/foods';
import { PAGE_SIZE } from '../../lib/usePagedList';
import { useFoodsList } from './useFoods';

// LL-1/B-122, re-paged by row offset in LD-1/B-303. The old test here pinned the cursor chain —
// "page 2 is fetched with page 1's next_cursor" — which is precisely what the batch removes: a
// cursor could only ever say "the page after this row", so reaching row 2 000 meant walking there.
// What is pinned now: a page is addressed by its offset, and asking for a far row fetches THAT
// page rather than everything before it.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function food(id: string): FoodListResponse['data'][number] {
  return { id, name: id } as never;
}

/** A page of two rows out of `total`, echoing the offset it was asked for. */
function page(prefix: string) {
  return {
    data: [food(`${prefix}1`), food(`${prefix}2`)],
    next_cursor: 'c',
    total: 500,
    with_comment: 0,
    sources: ['manual'] as FoodListResponse['sources'],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFoodsList — offset paging (B-303)', () => {
  it('asks for page 0 at offset 0 and reports the filter-wide total', async () => {
    const listSpy = vi.spyOn(foodsApi, 'list').mockResolvedValue(page('a'));

    const { result } = renderHook(() => useFoodsList({ sort: 'name', dir: 'asc' }), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(500));
    expect(result.current.rows.map((f) => f.id)).toEqual(['a1', 'a2']);
    expect(listSpy).toHaveBeenLastCalledWith({
      sort: 'name',
      dir: 'asc',
      offset: 0,
      limit: PAGE_SIZE,
    });
    // `sources` (B-295) rides on the envelope and is filter-independent, so it is read from
    // whichever page answered — after a jump that is not page 0.
    expect(result.current.sources).toEqual(['manual']);
  });

  it('jumps straight to the page holding a far row, without walking the ones before it', async () => {
    const listSpy = vi.spyOn(foodsApi, 'list').mockResolvedValue(page('a'));
    const { result } = renderHook(() => useFoodsList({ sort: 'name', dir: 'asc' }), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(500));
    listSpy.mockClear();

    // Row 400 lives in page 8 (50 rows per page).
    act(() => result.current.requestRow(400));

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    // The FIRST request after the jump is the target page itself — the whole point of the change.
    expect(listSpy.mock.calls[0]?.[0]).toMatchObject({ offset: 8 * PAGE_SIZE });
  });

  it('never refetches a page it already holds (D17)', async () => {
    const listSpy = vi.spyOn(foodsApi, 'list').mockResolvedValue(page('a'));
    const { result } = renderHook(() => useFoodsList({ sort: 'name', dir: 'asc' }), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(500));
    listSpy.mockClear();

    act(() => result.current.requestRow(10)); // still page 0, already loaded
    await new Promise((r) => setTimeout(r, 20));
    expect(listSpy).not.toHaveBeenCalled();
  });
});
