import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

// useIsMobile() is the single viewport signal (overlay variants + list render-switches),
// so its contract is unit-tested (logic) — layout/media-query behaviour is verified by
// inspection at breakpoints, not here.

type Listener = () => void;

// Minimal MediaQueryList double: we control `matches` and fire `change` ourselves.
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(max-width: 560px)',
    addEventListener: (_: 'change', cb: Listener) => listeners.add(cb),
    removeEventListener: (_: 'change', cb: Listener) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as typeof window.matchMedia;
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
    listenerCount: () => listeners.size,
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    // Restore so unrelated tests see a clean window.
    vi.unstubAllGlobals();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('reflects the initial match state', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => mm.setMatches(true));
    expect(result.current).toBe(true);

    act(() => mm.setMatches(false));
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const mm = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mm.listenerCount()).toBe(1);
    unmount();
    expect(mm.listenerCount()).toBe(0);
  });

  it('returns false when matchMedia is unavailable (jsdom / non-browser)', () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
