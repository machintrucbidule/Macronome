import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-259 guard. The taskbar shortcut icons are supposed to BE the mobile bottom nav's glyphs, so
// the jump list and the phone tab bar show the same mark. "Supposed to" is worthless without a
// check: the SVG sources are separate files, and nothing but this test stops one side from being
// redrawn while the other stays put.
//
// It also asserts that every asset the manifest promises actually exists on disk — a manifest
// pointing at a missing icon degrades silently to the app icon, which is precisely the state
// B-259 set out to fix.

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(web, p), 'utf8');

/** Every `d="…"` of an SVG/TSX fragment, in document order. */
function paths(source: string): string[] {
  return [...source.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1] as string);
}

/** The `ICON.<key>` fragment of BottomNav.tsx — the authority for the four reused glyphs. */
function bottomNavGlyph(key: string): string {
  const nav = read('src/app/BottomNav.tsx');
  const start = nav.indexOf(`${key}:`);
  expect(start, `ICON.${key} missing from BottomNav`).toBeGreaterThan(-1);
  // Up to the next top-level key of the ICON map, or the map's end.
  const rest = nav.slice(start);
  const end = rest.search(/\n} as const;/);
  const next = rest.slice(1).search(/\n {2}[a-z]+: /);
  return rest.slice(0, next > -1 && next < end ? next + 1 : end);
}

// Repas / Poids / Journal / Stats reuse a bottom-nav glyph. Paramètres has no counterpart there
// (the bar carries only the six primary routes), so it is the one drawn for this set and has
// nothing to be compared against.
const REUSED = [
  ['meals', 'meals'],
  ['weight', 'weight'],
  ['journal', 'journal'],
  ['stats', 'stats'],
] as const;

describe('taskbar shortcut icons reuse the mobile nav glyphs (B-259)', () => {
  it.each(REUSED)('shortcut-%s carries BottomNav ICON.%s verbatim', (file, key) => {
    const svg = read(`icons/shortcut-${file}.svg`);
    const expected = paths(bottomNavGlyph(key));
    expect(expected.length, `ICON.${key} declares no path`).toBeGreaterThan(0);
    // Only `d` attributes are compared, and that is enough here: the brand disc is a <rect>, so
    // every `d` in the file belongs to the glyph. Caveat worth stating rather than glossing —
    // ICON.journal also uses a <rect> for the page outline, which this therefore does NOT guard;
    // its `d` half (the spine + binding rings) is covered like the others.
    expect(paths(svg)).toEqual(expected);
  });

  it('the Paramètres glyph is the only one with no bottom-nav counterpart', () => {
    expect(read('src/app/BottomNav.tsx')).not.toMatch(/\n {2}settings: /);
    expect(paths(read('icons/shortcut-settings.svg')).length).toBeGreaterThan(0);
  });
});

describe('the manifest only promises assets that exist (B-259)', () => {
  const config = read('vite.config.ts');

  it('ships a rasterised PNG for every shortcut SVG source', () => {
    for (const [file] of REUSED) {
      expect(existsSync(join(web, `public/shortcuts/shortcut-${file}.png`))).toBe(true);
    }
    expect(existsSync(join(web, 'public/shortcuts/shortcut-settings.png'))).toBe(true);
  });

  it('ships every screenshot the manifest lists', () => {
    const srcs = [...config.matchAll(/src: '(screenshots\/[^']+)'/g)].map((m) => m[1] as string);
    expect(srcs.length).toBe(3);
    for (const src of srcs) expect(existsSync(join(web, 'public', src))).toBe(true);
  });

  it('declares the identity + presentation fields that were missing', () => {
    expect(config).toMatch(/\bid: '\/'/); // freezes the install identity against a start_url change
    expect(config).toMatch(/categories: \[/);
    expect(config).toMatch(/globIgnores: \['\*\*\/screenshots\/\*\*'\]/); // never precached
    expect(read('index.html')).toMatch(/<meta name="description"/);
  });
});
