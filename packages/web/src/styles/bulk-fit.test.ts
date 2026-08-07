import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// BE-1 follow-up — two overflows the owner found on a phone, both of the same family: a flex child
// that refuses to shrink pushes its row (or its sheet) wider than the screen. jsdom neither lays
// out nor measures, so the failures are invisible to a rendering test; this is a source guard, the
// same shape as `list-anchoring.test.ts` and the two `*-columns.test.ts`.
//
//  1. The mobile toolbar's search field ran UNDER the icon controls to its right, because the
//     shared `.search` carried a hard 200px floor while the row does not wrap.
//  2. The Aliments batch popup scrolled SIDEWAYS, because its segmented controls kept their
//     natural inline width — « Ne pas modifier » plus a four-way Source group does not fit 360px.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

/** The body of one class block, so a declaration cannot be matched from a neighbouring rule. */
function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

describe('the phone toolbar gives way to its controls (BE-1 follow-up)', () => {
  const chrome = read('components/ListChrome/list-chrome.module.css');
  const form = read('components/Form/Form.module.css');

  it('lets the leading slot shrink, and be the one that shrinks', () => {
    const leading = block(chrome, '.leading');
    expect(leading).toMatch(/min-width:\s*0/);
    expect(leading).toMatch(/flex:\s*1/);
  });

  it('keeps the icon controls at their tap size', () => {
    expect(block(chrome, '.actions')).toMatch(/flex:\s*none/);
  });

  it('gives the search field a preferred width, not a floor', () => {
    const search = block(form, '.search');
    // A `min-width: 200px` here is exactly what made it overrun the buttons.
    expect(search).toMatch(/min-width:\s*0/);
    expect(search).toMatch(/flex:\s*1\s+1\s+200px/);
  });
});

describe('the batch popup fits its sheet (BE-1 follow-up)', () => {
  const foods = read('features/foods/foods.module.css');
  const recipes = read('features/recipes/recipes.module.css');

  it('lets the batch form shrink below its content on both screens', () => {
    expect(block(foods, '.bulkFields')).toMatch(/min-width:\s*0/);
    expect(block(recipes, '.bulkFields')).toMatch(/min-width:\s*0/);
  });

  it('makes the batch segmented span the width and share it between its options', () => {
    expect(block(foods, '.bulkFields .visseg')).toMatch(/width:\s*100%/);
    const button = block(foods, '.bulkFields .visseg button');
    expect(button).toMatch(/flex:\s*1\s+1\s+0/);
    expect(button).toMatch(/min-width:\s*0/);
    // Wrapping the label is what keeps a long option from widening the panel instead.
    expect(button).toMatch(/white-space:\s*normal/);
  });
});
