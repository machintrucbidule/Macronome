import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-328 guard. `design/components/bottom-nav.md` §FAB names the screens that carry the mobile "+"
// button. That list and the code had silently disagreed for months — the doc said three screens,
// the app shipped four — and nothing would have caught it: each screen places its own <Fab/>, so
// adding one anywhere is a one-line edit no test looked at. This is the test that looks.
//
// The rule the list encodes is structural: a phone layout that is a card list whose main action is
// "add one". Repas, Journal and Stats are excluded because their add actions are per-meal /
// per-day / none, so a single screen-level "+" would have nothing unambiguous to do.

const features = join(dirname(fileURLToPath(import.meta.url)), '..', 'features');

const EXPECTED = ['containers', 'foods', 'recipes', 'weight'];

/** Every feature folder holding a component that renders <Fab …/>. */
function featuresWithFab(): string[] {
  const found = new Set<string>();
  const walk = (dir: string, feature: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, feature);
      else if (entry.endsWith('.tsx') && /<Fab\b/.test(readFileSync(full, 'utf8'))) {
        found.add(feature);
      }
    }
  };
  for (const feature of readdirSync(features)) {
    const dir = join(features, feature);
    if (statSync(dir).isDirectory()) walk(dir, feature);
  }
  return [...found].sort();
}

describe('the mobile FAB is on exactly the screens the contract names (B-328)', () => {
  it('places one on Aliments, Recettes, Poids and Contenants — and nowhere else', () => {
    expect(featuresWithFab()).toEqual(EXPECTED);
  });
});
