import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { daysApi } from '../../api/days';
import { journalApi } from '../../api/journal';
import { useJournal } from './useJournal';

// B-098: a rejected day PATCH on the Journal must surface its error code (the page shows a
// banner), and a subsequent successful patch clears it — mirroring the Repas error pattern.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useJournal — PATCH error surfacing (B-098)', () => {
  it('exposes the error code on a rejected patch, then clears it on success', async () => {
    vi.spyOn(journalApi, 'list').mockResolvedValue({ data: [], day_count: 0 } as never);
    const patchSpy = vi
      .spyOn(daysApi, 'patch')
      .mockRejectedValueOnce(new ApiError(409, 'summary_day_readonly'));

    const { result } = renderHook(() => useJournal(2026), { wrapper });

    result.current.patch.mutate({ date: '2026-01-01', body: { activity_level: 'very_active' } });
    await waitFor(() => expect(result.current.error).toBe('summary_day_readonly'));

    // A following successful patch clears the error.
    patchSpy.mockResolvedValueOnce({} as never);
    result.current.patch.mutate({ date: '2026-01-01', body: { comment: 'ok' } });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('falls back to request_failed when the rejection is not an ApiError', async () => {
    vi.spyOn(journalApi, 'list').mockResolvedValue({ data: [], day_count: 0 } as never);
    vi.spyOn(daysApi, 'patch').mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useJournal(2026), { wrapper });
    result.current.patch.mutate({ date: '2026-01-01', body: { comment: 'x' } });
    await waitFor(() => expect(result.current.error).toBe('request_failed'));
  });
});
