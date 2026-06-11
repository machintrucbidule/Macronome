import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncThemeColor } from './applySettings';

// PWA-1: the theme-color meta (OS status bar) must follow the live --bg token. We stub
// getComputedStyle so the test is deterministic and doesn't rely on jsdom CSS-var resolution.
describe('syncThemeColor', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('writes the live --bg token into the theme-color meta', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000000');
    document.head.appendChild(meta);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (p: string) => (p === '--bg' ? '#0d0f12' : ''),
    } as CSSStyleDeclaration);

    syncThemeColor();

    expect(meta.getAttribute('content')).toBe('#0d0f12');
  });

  it('no-ops safely when the meta is absent', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '#0d0f12',
    } as unknown as CSSStyleDeclaration);
    expect(() => syncThemeColor()).not.toThrow();
  });

  it('leaves the meta untouched when --bg resolves empty', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#abcabc');
    document.head.appendChild(meta);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);

    syncThemeColor();

    expect(meta.getAttribute('content')).toBe('#abcabc');
  });
});
