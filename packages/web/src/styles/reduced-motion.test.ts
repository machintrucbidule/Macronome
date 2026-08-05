import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-254: `prefers-reduced-motion` is handled in exactly ONE place — the global layer in
// global.css. This guard asserts that layer exists and neutralises the looping animations
// (the shimmer + the three spinners were the ones left uncovered), and that no component
// re-introduces its own block, which is how the coverage drifted to 3 of 9 animations.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const REDUCE = /@media\s*\(prefers-reduced-motion:\s*reduce\)/;

function cssModulesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return cssModulesUnder(full);
    return e.name.endsWith('.module.css') ? [full] : [];
  });
}

describe('reduced motion', () => {
  const global = readFileSync(join(SRC, 'styles/global.css'), 'utf8');

  it('global.css declares the app-wide reduce layer', () => {
    expect(global).toMatch(REDUCE);
  });

  it('the layer neutralises durations and stops looping animations', () => {
    const block = global.slice(global.search(REDUCE));
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('no CSS module declares its own reduced-motion block', () => {
    const offenders = cssModulesUnder(SRC).filter((f) => REDUCE.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
