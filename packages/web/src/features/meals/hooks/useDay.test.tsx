import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CreateMealEntryRequest, DayDetail, MealEntry } from '@macronome/shared';
import { daysApi } from '../../../api/days';
import { entriesApi } from '../../../api/entries';
import { useDay } from './useDay';

// B-294: every Repas mutation shares one `onSuccess`, and it invalidated `['day']` + `['journal']`
// only. The app-frame tone lives under `['day-tone']` — a disjoint cache — so the verdict badge
// went green while the title-strip rule and the app-icon badge stayed as they were.
const DATE = '2026-06-09';
const ENTRY: CreateMealEntryRequest = {
  kind: 'referenced',
  food_id: '11111111-1111-4111-8111-111111111111',
  served_quantity: 100,
  unit: 'g',
};

/** A client whose invalidations are recorded rather than run, plus its provider. */
function harness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const calls: unknown[][] = [];
  vi.spyOn(qc, 'invalidateQueries').mockImplementation((filters?: { queryKey?: unknown }) => {
    calls.push(filters?.queryKey as unknown[]);
    return Promise.resolve();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { keys: () => calls, wrapper };
}

afterEach(() => vi.restoreAllMocks());

describe('useDay invalidation scope (B-294)', () => {
  it('invalidates the app-frame tone after an entry mutation, not just the day and journal', async () => {
    vi.spyOn(daysApi, 'get').mockResolvedValue({} as DayDetail);
    vi.spyOn(entriesApi, 'create').mockResolvedValue({} as MealEntry);
    const { keys, wrapper } = harness();

    const { result } = renderHook(() => useDay(DATE), { wrapper });
    await result.current.createEntry.mutateAsync({ mealId: 'm1', body: ENTRY });

    await waitFor(() => expect(keys()).toContainEqual(['day-tone']));
    expect(keys()).toContainEqual(['day', DATE]);
    expect(keys()).toContainEqual(['journal']);
  });

  it('invalidates the tone after a whole-day mutation too', async () => {
    vi.spyOn(daysApi, 'get').mockResolvedValue({} as DayDetail);
    vi.spyOn(daysApi, 'clear').mockResolvedValue({} as DayDetail);
    const { keys, wrapper } = harness();

    const { result } = renderHook(() => useDay(DATE), { wrapper });
    await result.current.clearDay.mutateAsync();

    await waitFor(() => expect(keys()).toContainEqual(['day-tone']));
  });
});
