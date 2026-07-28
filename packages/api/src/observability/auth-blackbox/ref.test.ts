import { describe, expect, it } from 'vitest';
import { formatRef, newRef } from './ref.js';

const REF_SHAPE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

// The ref is read off a phone screen and typed back into a shell, so the alphabet must exclude the
// characters that get misread. Pinning it on fixed bytes keeps the format stable across changes.
describe('formatRef', () => {
  it('formats bytes as XXXX-XXXX', () => {
    expect(formatRef(Uint8Array.from([0, 1, 2, 3, 4]))).toBe('0123-4000');
  });

  it('excludes the ambiguous letters I, L, O and U', () => {
    const all = Array.from({ length: 256 }, (_, i) => formatRef(Uint8Array.from([i]))).join('');
    expect(all).not.toMatch(/[ILOU]/);
  });

  it('is deterministic', () => {
    const bytes = Uint8Array.from([31, 30, 29, 28, 27]);
    expect(formatRef(bytes)).toBe(formatRef(bytes));
  });
});

describe('newRef', () => {
  it('produces the documented shape', () => {
    expect(newRef()).toMatch(REF_SHAPE);
  });

  it('does not repeat itself across many draws', () => {
    const refs = new Set(Array.from({ length: 200 }, () => newRef()));
    expect(refs.size).toBeGreaterThan(190);
  });
});
