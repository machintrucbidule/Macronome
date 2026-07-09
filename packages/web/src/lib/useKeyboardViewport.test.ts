import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardViewport } from './useKeyboardViewport';

// useKeyboardViewport() is the single on-screen-keyboard signal for the mobile search sheets
// (B-206): it computes the keyboard's bottom overlap from window.visualViewport and mirrors it into
// the --kb-inset CSS variable. Logic (the inset math + the CSS var lifecycle) is unit-tested here;
// the actual sheet reflow with a real keyboard is verified by inspection on a device.

type Listener = () => void;

// Minimal visualViewport double: we drive `height`/`offsetTop` and fire `resize` ourselves.
function installViewport(innerHeight: number, height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<Listener>>();
  const vv = {
    height,
    offsetTop,
    addEventListener: (type: string, cb: Listener) => {
      (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(cb);
    },
    removeEventListener: (type: string, cb: Listener) => listeners.get(type)?.delete(cb),
  };
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return {
    resizeTo(nextHeight: number, nextOffsetTop = 0) {
      vv.height = nextHeight;
      vv.offsetTop = nextOffsetTop;
      listeners.get('resize')?.forEach((cb) => cb());
    },
    listenerCount: () =>
      (listeners.get('resize')?.size ?? 0) + (listeners.get('scroll')?.size ?? 0),
  };
}

function kbInset(): string {
  return document.documentElement.style.getPropertyValue('--kb-inset');
}

describe('useKeyboardViewport', () => {
  afterEach(() => {
    delete (window as { visualViewport?: unknown }).visualViewport;
    document.documentElement.style.removeProperty('--kb-inset');
  });

  it('is 0 (no inset) when the visible viewport fills the layout viewport', () => {
    installViewport(800, 800);
    const { result } = renderHook(() => useKeyboardViewport());
    expect(result.current).toBe(0);
    expect(kbInset()).toBe('0px');
  });

  it('reports the keyboard overlap and writes it to --kb-inset', () => {
    const vp = installViewport(800, 800);
    const { result } = renderHook(() => useKeyboardViewport());
    expect(result.current).toBe(0);

    // Keyboard opens: visible viewport shrinks to 500 → overlap 300.
    act(() => vp.resizeTo(500));
    expect(result.current).toBe(300);
    expect(kbInset()).toBe('300px');

    // Keyboard closes again.
    act(() => vp.resizeTo(800));
    expect(result.current).toBe(0);
    expect(kbInset()).toBe('0px');
  });

  it('accounts for a non-zero offsetTop (pinch/scroll)', () => {
    const vp = installViewport(800, 800);
    const { result } = renderHook(() => useKeyboardViewport());
    act(() => vp.resizeTo(600, 50)); // 800 - 600 - 50 = 150
    expect(result.current).toBe(150);
  });

  it('unsubscribes and clears --kb-inset on unmount', () => {
    const vp = installViewport(800, 500);
    const { unmount } = renderHook(() => useKeyboardViewport());
    expect(vp.listenerCount()).toBe(2); // resize + scroll
    expect(kbInset()).toBe('300px');
    unmount();
    expect(vp.listenerCount()).toBe(0);
    expect(kbInset()).toBe('');
  });

  it('returns 0 and writes nothing when visualViewport is unavailable (jsdom / non-browser)', () => {
    delete (window as { visualViewport?: unknown }).visualViewport;
    const { result } = renderHook(() => useKeyboardViewport());
    expect(result.current).toBe(0);
    expect(kbInset()).toBe('');
  });
});
