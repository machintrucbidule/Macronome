import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Same source guard as foods-columns.test.ts (B-284, data-tables.md §column sizing): a
// paginated table must lay out on declared widths, or each arriving page re-solves the whole
// table and the columns jump. jsdom cannot see a layout regression, hence a source-text test.
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'catalog.module.css'),
  'utf8',
);

describe('Catalogue Ciqual column widths (B-292)', () => {
  it('lays the table out on declared widths, not on the rendered content', () => {
    expect(css).toMatch(/\.catalogTable\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares a width for the five sized columns (Nom takes the remainder)', () => {
    const declared = css.match(/\.catalogTable th:nth-child\((\d+)\)/g) ?? [];
    expect(new Set(declared).size).toBe(5);
    expect(css).not.toMatch(/\.catalogTable th:nth-child\(1\)/);
  });

  it('keeps cells on one line, so every row stays the same height', () => {
    expect(css).toMatch(/\.catalogTable tbody td\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('ellipsises the name column instead of letting it widen the table', () => {
    expect(css).toMatch(/\.catalogTable td:nth-child\(1\)\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('needs no narrow band: six columns leave the name room at every width', () => {
    // Unlike the Aliments table (two bands), the declared columns here total 17.75rem. If a
    // column is ever added, redo the arithmetic before assuming this still holds.
    expect(css).not.toMatch(/@media \(max-width/);
  });
});
