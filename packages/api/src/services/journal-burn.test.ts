import { describe, expect, it } from 'vitest';
import type { WeightEntry as WeightEntryModel } from '@prisma/client';
import { weightAsOf } from './journal-burn.js';

// B-170: weightAsOf switched from a per-day linear scan to a binary search (the weigh-in series is
// date-ascending). These tests assert it stays OUTPUT-IDENTICAL to the original linear scan across
// the edge cases — before the first, exact match, between two, after the last, empty, single.
const w = (date: string, kg: number): WeightEntryModel =>
  ({ date: new Date(`${date}T00:00:00.000Z`), weightKg: kg }) as unknown as WeightEntryModel;

/** The original linear reference: latest weigh-in dated ≤ `date`. */
function refAsOf(weights: WeightEntryModel[], date: Date): number | null {
  for (let i = weights.length - 1; i >= 0; i -= 1) {
    if (weights[i]!.date <= date) return Number(weights[i]!.weightKg.toString());
  }
  return null;
}

describe('weightAsOf binary search (perf B-170)', () => {
  const series = [
    w('2025-01-01', 80),
    w('2025-02-01', 81),
    w('2025-03-15', 79),
    w('2025-06-10', 78),
  ];

  it('returns null on an empty series', () => {
    expect(weightAsOf([], new Date('2025-01-01T00:00:00.000Z'))).toBeNull();
  });

  it('returns null before the first weigh-in', () => {
    expect(weightAsOf(series, new Date('2024-12-31T00:00:00.000Z'))).toBeNull();
  });

  it('matches the linear reference on exact dates, between, and after the last', () => {
    const probes = [
      '2025-01-01',
      '2025-01-15',
      '2025-02-01',
      '2025-02-28',
      '2025-03-15',
      '2025-03-16',
      '2025-06-10',
      '2025-12-31',
    ];
    for (const p of probes) {
      const d = new Date(`${p}T00:00:00.000Z`);
      expect(weightAsOf(series, d)).toBe(refAsOf(series, d));
    }
  });

  it('handles a single-element series', () => {
    const one = [w('2025-05-01', 75)];
    expect(weightAsOf(one, new Date('2025-04-30T00:00:00.000Z'))).toBeNull();
    expect(weightAsOf(one, new Date('2025-05-01T00:00:00.000Z'))).toBe(75);
    expect(weightAsOf(one, new Date('2025-09-01T00:00:00.000Z'))).toBe(75);
  });
});
