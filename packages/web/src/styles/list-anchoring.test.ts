import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// LD-1/B-303 follow-up. A backfilled page lands ABOVE the viewport — new since the jump-aware
// loading, where pages used to only ever append below. The browser then "helpfully" compensates for
// the gap shrinking and pulls the scroll up by exactly that page, once per page delivered: measured
// at thirteen steps of 2 385 px on the Ciqual catalog, while the document height never moved.
//
// These lists compute their own reserved height, so the compensation only ever fights them. The
// opt-out is one declaration per list and is invisible in the components — hence this guard, the
// same shape as `autofill.test.ts` and `reduced-motion.test.ts`. The drift itself cannot be
// asserted: jsdom neither scrolls nor implements anchoring.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

/** The rows container of each paginated list, and the selector that must carry the opt-out. */
const CONTAINERS: [string, string][] = [
  ['features/foods/foods.module.css', '.foodsTable'],
  ['features/foods/catalog/catalog.module.css', '.catalogTable'],
  ['features/recipes/recipes.module.css', '.recipesTable'],
  ['features/foods/foods-mobile.module.css', '.cardList'],
  ['features/recipes/recipes-mobile.module.css', '.cardList'],
];

describe('paged lists opt out of scroll anchoring (B-303 follow-up)', () => {
  for (const [file, selector] of CONTAINERS) {
    it(`${file} — ${selector}`, () => {
      const css = read(file);
      const block = new RegExp(`\\${selector}\\s*\\{[^}]*overflow-anchor:\\s*none`);
      expect(css).toMatch(block);
    });
  }

  it('is scoped to those lists — the Journal appends below and needs no opt-out', () => {
    expect(read('features/journal/journal.module.css')).not.toMatch(/overflow-anchor/);
    expect(read('styles/global.css')).not.toMatch(/overflow-anchor/);
  });
});

// The same lists reserve height for rows they have not drawn, which only works if every row of a
// given variant is the same height. On a phone two value lines were free to wrap, and unlike the
// Aliments comment sub-line a wrap cannot be counted server-side — it depends on the text and the
// screen width. They are kept to one line instead.
describe('mobile card values stay on one line (B-303 follow-up)', () => {
  it('the shared value line is nowrap + ellipsis', () => {
    const css = read('features/foods/foods-mobile.module.css');
    expect(css).toMatch(/\.portionValue\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.portionValue\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('the Ciqual group label no longer opts back into wrapping', () => {
    expect(read('features/foods/catalog/catalog.module.css')).not.toMatch(/white-space:\s*normal/);
  });
});
