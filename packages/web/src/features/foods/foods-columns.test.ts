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

  it('declares a width for the nine sized columns (Nom takes the remainder)', () => {
    const declared = css.match(/\.foodsTable th:nth-child\((\d+)\)/g) ?? [];
    expect(new Set(declared).size).toBe(9);
    expect(css).not.toMatch(/\.foodsTable th:nth-child\(1\)/);
  });

  it('keeps cells on one line, so every row stays the same height', () => {
    expect(css).toMatch(/\.foodsTable tbody td\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('ellipsises the name column instead of letting it widen the table', () => {
    expect(css).toMatch(/\.foodsTable td:nth-child\(1\)\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('hides header and cell together in the 561-820px band', () => {
    // The old rule hid the `.portion`/`.vis` <td> classes only, which the <th>s never carried, so
    // the body slid one column left. Both indices must appear as th AND td inside the media query.
    const band = /@media \(max-width: 820px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    for (const n of [6, 8]) {
      expect(band).toContain(`.foodsTable th:nth-child(${n})`);
      expect(band).toContain(`.foodsTable td:nth-child(${n})`);
    }
  });
});
