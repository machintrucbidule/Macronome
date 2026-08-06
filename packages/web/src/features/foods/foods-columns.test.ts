import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-284: with `auto` layout a column is as wide as the widest row *currently rendered*, so every
// 50-row page the infinite scroll appended re-solved the whole table and the columns jumped. The
// widths must be declared, the rows must not wrap (uniform height feeds the scroll reserve), and
// the one undeclared column — Nom, which absorbs the remainder — must truncate rather than push
// the others around. A source guard, because the failure is a layout regression jsdom cannot see.
// Same shape as journal-columns.test.ts, the screen that set the precedent (B-276).
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'foods.module.css'), 'utf8');

describe('Aliments column widths (B-284)', () => {
  it('lays the table out on declared widths, not on the rendered content', () => {
    expect(css).toMatch(/\.foodsTable\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares a width for the ten sized columns (Nom takes the remainder)', () => {
    const declared = css.match(/\.foodsTable th:nth-child\((\d+)\)/g) ?? [];
    expect(new Set(declared).size).toBe(10);
    expect(css).not.toMatch(/\.foodsTable th:nth-child\(1\)/);
  });

  it('keeps cells on one line, so every row stays the same height', () => {
    expect(css).toMatch(/\.foodsTable tbody td\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('ellipsises the name column instead of letting it widen the table', () => {
    expect(css).toMatch(/\.foodsTable td:nth-child\(1\)\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  // Both bands hide by index, and both must hide the header WITH the cell: the old rule hid the
  // `.portion`/`.vis` <td> classes only, which the <th>s never carried, so the body slid one
  // column left and the stars rendered under "PORTION".
  const bandAt = (px: number): string =>
    new RegExp(`@media \\(max-width: ${px}px\\) \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? '';

  it('hides the Source column below 960px, header and cell together', () => {
    // Source is the widest chip column (B-291); without its own band the elastic Nom column goes
    // negative between 821 and ~900px and the table overflows the page.
    const band = bandAt(960);
    expect(band).toContain('.foodsTable th:nth-child(8)');
    expect(band).toContain('.foodsTable td:nth-child(8)');
  });

  it('hides Portion and Visibilité together in the 561-820px band', () => {
    const band = bandAt(820);
    for (const n of [6, 9]) {
      expect(band).toContain(`.foodsTable th:nth-child(${n})`);
      expect(band).toContain(`.foodsTable td:nth-child(${n})`);
    }
  });
});
