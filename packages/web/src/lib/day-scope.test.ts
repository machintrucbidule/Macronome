import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateDayScope, invalidateDayTone } from './day-scope';

// B-294: the app-frame tone lived in its own cache key that nothing ever invalidated, so the
// title-strip rule and the app-icon badge stayed frozen until a restart. These assertions pin
// the contract of the single helper every day-changing write now goes through.
function spy(): { qc: QueryClient; keys: () => unknown[][] } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const calls: unknown[][] = [];
  vi.spyOn(qc, 'invalidateQueries').mockImplementation((filters?: { queryKey?: unknown }) => {
    calls.push(filters?.queryKey as unknown[]);
    return Promise.resolve();
  });
  return { qc, keys: () => calls };
}

describe('invalidateDayScope (B-294)', () => {
  it('invalidates the day sheet, the journal AND the app-frame tone', () => {
    const { qc, keys } = spy();
    invalidateDayScope(qc, '2026-06-09');
    expect(keys()).toContainEqual(['day', '2026-06-09']);
    expect(keys()).toContainEqual(['journal']);
    expect(keys()).toContainEqual(['day-tone']);
  });

  it('invalidates the tone by prefix, never keyed on the mutated date', () => {
    const { qc, keys } = spy();
    invalidateDayScope(qc, '2026-06-09');
    // The rule tracks TODAY, which need not be the day being edited: a key-with-date would miss it.
    expect(keys()).not.toContainEqual(['day-tone', '2026-06-09']);
  });

  it('without a date, invalidates every day', () => {
    const { qc, keys } = spy();
    invalidateDayScope(qc);
    expect(keys()).toContainEqual(['day']);
    expect(keys()).toContainEqual(['day-tone']);
  });
});

describe('invalidateDayTone (B-294)', () => {
  it('touches the tone only', () => {
    const { qc, keys } = spy();
    invalidateDayTone(qc);
    expect(keys()).toEqual([['day-tone']]);
  });
});
