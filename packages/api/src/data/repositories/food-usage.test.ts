import { describe, expect, test } from 'vitest';
import { rankByUsage, type UsageInfo } from './food-usage.js';

// Most-used-first ordering (FU-1/B-151): count desc → most-recent use → name → id.

interface Item {
  id: string;
  name: string;
}
const item = (id: string, name: string): Item => ({ id, name });
const usage = (entries: [string, UsageInfo][]): Map<string, UsageInfo> => new Map(entries);

describe('rankByUsage', () => {
  test('orders by 90-day count desc, then recency, then name (dir=desc)', () => {
    const items = [item('a', 'Avocat'), item('b', 'Banane'), item('c', 'Carotte')];
    const u = usage([
      ['a', { count: 2, lastUsed: '2026-01-01' }],
      ['b', { count: 5, lastUsed: '2026-02-01' }],
      ['c', { count: 2, lastUsed: '2026-03-01' }], // same count as a, but more recent
    ]);
    expect(rankByUsage(items, u, 'desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  test('never-logged foods (count 0) sink to the end, sorted A→Z among themselves', () => {
    const items = [item('z', 'Zucchini'), item('m', 'Mangue'), item('p', 'Pomme')];
    const u = usage([['p', { count: 1, lastUsed: '2026-04-01' }]]);
    // p (used) first; then the two never-logged sorted by name: Mangue < Zucchini.
    expect(rankByUsage(items, u, 'desc').map((i) => i.id)).toEqual(['p', 'm', 'z']);
  });

  test('equal count + equal recency falls back to name then id (stable, total order)', () => {
    const items = [item('b2', 'Pomme'), item('a1', 'Pomme')];
    const u = usage([
      ['a1', { count: 1, lastUsed: '2026-05-01' }],
      ['b2', { count: 1, lastUsed: '2026-05-01' }],
    ]);
    // same name + same usage → id tiebreak: 'a1' < 'b2'.
    expect(rankByUsage(items, u, 'desc').map((i) => i.id)).toEqual(['a1', 'b2']);
  });

  test('dir=asc flips the count axis (least-used first)', () => {
    const items = [item('a', 'Avocat'), item('b', 'Banane')];
    const u = usage([
      ['a', { count: 2, lastUsed: '2026-01-01' }],
      ['b', { count: 5, lastUsed: '2026-02-01' }],
    ]);
    expect(rankByUsage(items, u, 'asc').map((i) => i.id)).toEqual(['a', 'b']);
  });
});
