import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Settings } from '@macronome/shared';
import { useWeightMode } from './useWeightMode';
import { settingsApi } from '../../api/settings';

// B-177: the Poids Régime/Maintien mode must persist. useWeightMode seeds the screen-local mode
// from the server's current_mode and, on change, persists it via PATCH /settings (so it survives
// a refresh) while keeping the optimistic local update.
const SETTINGS: Settings = { locale: 'fr', theme: 'dark', ai: null, current_mode: 'not_in_diet' };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe('useWeightMode (B-177)', () => {
  it('seeds the local mode from the server current_mode', () => {
    const { result } = renderHook(() => useWeightMode('in_diet'), { wrapper });
    expect(result.current.mode).toBe('in_diet');
  });

  it('persists a mode change via PATCH /settings and updates the local mode optimistically', async () => {
    const patchSpy = vi.spyOn(settingsApi, 'patch').mockResolvedValue({ data: SETTINGS });
    const { result } = renderHook(() => useWeightMode('in_diet'), { wrapper });
    expect(result.current.mode).toBe('in_diet');

    act(() => result.current.setMode('not_in_diet'));

    expect(result.current.mode).toBe('not_in_diet'); // optimistic, immediate
    await waitFor(() => expect(patchSpy).toHaveBeenCalledWith({ current_mode: 'not_in_diet' }));
  });
});
