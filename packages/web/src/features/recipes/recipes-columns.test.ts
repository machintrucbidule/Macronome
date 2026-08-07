import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-284: same failure as Aliments — under `auto` layout each appended page re-solved every column
// and the table jumped while scrolling. Widths declared, rows on one line, Nom left undeclared to
// absorb the remainder and truncating. A source guard: jsdom cannot catch a layout regression.
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'recipes.module.css'),
  'utf8',
);

describe('Recettes column widths (B-284)', () => {
  it('lays the table out on declared widths, not on the rendered content', () => {
    expect(css).toMatch(/\.recipesTable\s*\{[^}]*table-layout:\s*fixed/);
  });

  // BE-1 put the selection checkbox in a column of its own at index 1, so every other index moved
  // up one: ten declared widths now, and Nom — still the single elastic column — is index 2.
  it('declares a width for the ten sized columns (Nom takes the remainder)', () => {
    const declared = css.match(/\.recipesTable th:nth-child\((\d+)\)/g) ?? [];
    expect(new Set(declared).size).toBe(10);
    expect(css).not.toMatch(/\.recipesTable th:nth-child\(2\)/);
  });

  it('keeps cells on one line, so every row stays the same height', () => {
    expect(css).toMatch(/\.recipesTable tbody td\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('ellipsises the name column instead of letting it widen the table', () => {
    expect(css).toMatch(/\.recipesTable td:nth-child\(2\)\s*\{[^}]*text-overflow:\s*ellipsis/);
  });
});
