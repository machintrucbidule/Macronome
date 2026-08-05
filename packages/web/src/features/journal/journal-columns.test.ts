import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-276: with `auto` layout a column is as wide as the widest row *currently rendered*, so
// progressive rendering (B-275) made the headers shift while scrolling — a day carrying a kcal
// écart widened the Verdict column, the next one without it narrowed it again. The widths must be
// declared, and the rows must not wrap (a wrapped cell also breaks B-275's uniform row pitch).
// A source guard, because the failure is a layout regression no rendered test would catch in jsdom.
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'journal.module.css'),
  'utf8',
);

describe('Journal column widths (B-276)', () => {
  it('lays the table out on declared widths, not on the rendered content', () => {
    expect(css).toMatch(/\.journalTable\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares a width for the five sized columns (the comment takes the remainder)', () => {
    const declared = css.match(/\.journalTable td:nth-child\((\d)\)/g) ?? [];
    expect(new Set(declared).size).toBe(5);
  });

  it('keeps cells on one line, so every row stays the same height', () => {
    expect(css).toMatch(/\.journalTable tbody td\s*\{[^}]*white-space:\s*nowrap/);
  });
});
