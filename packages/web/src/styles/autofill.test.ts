import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-305: the browser's autofill highlight is neutralised in exactly ONE place — global.css — so a
// field the password manager filled keeps `--bg-field` on every screen at once (D23), not only on
// the one screen somebody happened to check. The paint itself cannot be asserted (jsdom renders no
// UA autofill layer), so this guards the source: the rule exists, repaints with the field token,
// carries the marker, keeps the focus ring, and is not re-scattered into component CSS.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUTOFILL = /:(-webkit-)?autofill/;

function cssModulesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return cssModulesUnder(full);
    return e.name.endsWith('.module.css') ? [full] : [];
  });
}

describe('autofilled fields keep the app appearance (B-305)', () => {
  const global = readFileSync(join(SRC, 'styles/global.css'), 'utf8');
  const block = global.slice(global.search(AUTOFILL));

  it('global.css declares the autofill rule for both engines', () => {
    expect(global).toMatch(/input:-webkit-autofill/); // Chromium / WebKit
    expect(global).toMatch(/input:autofill/); // the standard property (Firefox)
  });

  it('repaints the field with the field token and keeps the text readable', () => {
    expect(block).toMatch(/inset 0 0 0 100px var\(--bg-field\)/);
    expect(block).toMatch(/-webkit-text-fill-color:\s*var\(--text\)/);
  });

  it('carries the autofilled marker BEFORE the repaint, so it is not painted over', () => {
    const marker = block.indexOf('inset 2px 0 0 var(--accent)');
    const repaint = block.indexOf('inset 0 0 0 100px var(--bg-field)');
    expect(marker).toBeGreaterThanOrEqual(0);
    expect(marker).toBeLessThan(repaint);
  });

  it('keeps the focus ring on an autofilled field', () => {
    expect(block).toMatch(/:-webkit-autofill:-webkit-autofill:focus/);
    expect(block).toMatch(/0 0 0 3px color-mix\(in srgb, var\(--focus\) 22%, transparent\)/);
  });

  it('no CSS module declares its own autofill rule', () => {
    const offenders = cssModulesUnder(SRC).filter((f) => AUTOFILL.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
