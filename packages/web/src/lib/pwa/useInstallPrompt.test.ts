import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

// PWA-1/B-144: the install invite appears only after the browser fires beforeinstallprompt
// (Android/Chromium) and disappears once installed. iOS Safari never fires it → canInstall stays
// false (covered by the initial state with no event).
function fakePromptEvent(): Event & { prompt: ReturnType<typeof vi.fn> } {
  const e = new Event('beforeinstallprompt') as Event & { prompt: ReturnType<typeof vi.fn> };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  return e;
}

describe('useInstallPrompt', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.restoreAllMocks();
  });

  function stubNotStandalone() {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
  }

  it('stays uninstallable until the browser offers it', () => {
    stubNotStandalone();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('exposes install after beforeinstallprompt and prompts once on demand', () => {
    stubNotStandalone();
    const { result } = renderHook(() => useInstallPrompt());
    const evt = fakePromptEvent();
    act(() => {
      window.dispatchEvent(evt);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => result.current.promptInstall());
    expect(evt.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('hides again after the app is installed', () => {
    stubNotStandalone();
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(fakePromptEvent());
    });
    expect(result.current.canInstall).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.canInstall).toBe(false);
  });
});
