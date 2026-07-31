import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/config';
import { currentAppearance, syncThemeColor } from './applySettings';

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

// B-237: the account-creation payload carries whatever the pre-auth bar last applied, so the new
// account's settings start on that choice instead of the stored fr/dark defaults.
describe('currentAppearance', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fr');
  });

  it('falls back to the app defaults on a fresh browser', () => {
    expect(currentAppearance()).toEqual({ locale: 'fr', theme: 'dark' });
  });

  it('reads the live language and the stored theme mode', async () => {
    await i18n.changeLanguage('en');
    localStorage.setItem('macronome.theme', 'light');

    expect(currentAppearance()).toEqual({ locale: 'en', theme: 'light' });
  });

  it('keeps the tri-state system mode and ignores an unknown stored value', () => {
    localStorage.setItem('macronome.theme', 'system');
    expect(currentAppearance().theme).toBe('system');

    localStorage.setItem('macronome.theme', 'sepia');
    expect(currentAppearance().theme).toBe('dark');
  });
});
