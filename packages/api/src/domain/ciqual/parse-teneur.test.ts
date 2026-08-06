import { describe, expect, it } from 'vitest';
import { parseTeneur } from './parse-teneur.js';

// Oracles: spec/logic/ciqual-catalog.md §3 (value forms) — the raw strings keep the source's
// leading/trailing padding so the trim is exercised, not assumed.
describe('parseTeneur (ciqual-catalog.md §3)', () => {
  it('reads a comma decimal', () => {
    expect(parseTeneur(' 12,5 ')).toBe(12.5);
  });

  it('reads a plain integer', () => {
    expect(parseTeneur(' 1140 ')).toBe(1140);
  });

  it('treats `traces` as 0', () => {
    expect(parseTeneur(' traces ')).toBe(0);
  });

  it('treats a below-LOQ threshold as 0', () => {
    expect(parseTeneur(' < 0,01 ')).toBe(0);
    expect(parseTeneur(' < 20 ')).toBe(0);
  });

  it('treats a zero threshold as 0 (the `< 0` edge case)', () => {
    expect(parseTeneur(' < 0 ')).toBe(0);
  });

  it('treats `-` as unknown, not as 0', () => {
    expect(parseTeneur(' - ')).toBeNull();
  });

  it('reads scientific notation', () => {
    expect(parseTeneur(' 1E-6 ')).toBe(0.000001);
  });

  it('treats an empty or unreadable value as unknown', () => {
    expect(parseTeneur('   ')).toBeNull();
    expect(parseTeneur(' n/a ')).toBeNull();
  });
});
