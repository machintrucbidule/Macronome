import { describe, expect, it } from 'vitest';
import type { JournalRow } from '@macronome/shared';
import { sortRows } from './sort';

// Unit oracle for the Journal client-side sort (B-067). Each key must order both
// directions; the default the page applies is date-descending; verdict nulls sort last.
function row(p: Partial<JournalRow> & { date: string }): JournalRow {
  return {
    date: p.date,
    kcal: p.kcal ?? 0,
    macros: p.macros ?? null,
    verdict_auto: p.verdict_auto ?? null,
    verdict_override: p.verdict_override ?? null,
    effective_verdict: p.effective_verdict ?? null,
    activity_level: p.activity_level ?? 'sedentary',
    comment: p.comment ?? null,
    kind: p.kind ?? 'detailed',
    state: p.state ?? 'green',
    editable_kcal: p.editable_kcal ?? false,
  };
}

const dates = (rows: JournalRow[]): string[] => rows.map((r) => r.date);

describe('sortRows (Journal)', () => {
  const a = row({
    date: '2026-03-01',
    kcal: 2100,
    effective_verdict: 'NOK',
    activity_level: 'very_active',
  });
  const b = row({
    date: '2026-01-15',
    kcal: 1800,
    effective_verdict: 'OK',
    activity_level: 'sedentary',
  });
  const c = row({
    date: '2026-02-10',
    kcal: 1950,
    effective_verdict: null,
    activity_level: 'moderately_active',
  });
  const rows = [a, b, c];

  it('sorts by date both directions (desc is the page default)', () => {
    expect(dates(sortRows(rows, 'date', 'desc'))).toEqual([
      '2026-03-01',
      '2026-02-10',
      '2026-01-15',
    ]);
    expect(dates(sortRows(rows, 'date', 'asc'))).toEqual([
      '2026-01-15',
      '2026-02-10',
      '2026-03-01',
    ]);
  });

  it('sorts by calories numerically', () => {
    expect(dates(sortRows(rows, 'kcal', 'asc'))).toEqual([
      '2026-01-15',
      '2026-02-10',
      '2026-03-01',
    ]);
    expect(dates(sortRows(rows, 'kcal', 'desc'))).toEqual([
      '2026-03-01',
      '2026-02-10',
      '2026-01-15',
    ]);
  });

  it('sorts by activity along the sedentary→active scale', () => {
    expect(dates(sortRows(rows, 'activity', 'asc'))).toEqual([
      '2026-01-15',
      '2026-02-10',
      '2026-03-01',
    ]);
    expect(dates(sortRows(rows, 'activity', 'desc'))).toEqual([
      '2026-03-01',
      '2026-02-10',
      '2026-01-15',
    ]);
  });

  it('sorts by verdict with nulls last in both directions', () => {
    // asc: OK, NOK, then null
    expect(dates(sortRows(rows, 'verdict', 'asc'))).toEqual([
      '2026-01-15',
      '2026-03-01',
      '2026-02-10',
    ]);
    // desc: NOK, OK, then null (null stays last)
    expect(dates(sortRows(rows, 'verdict', 'desc'))).toEqual([
      '2026-03-01',
      '2026-01-15',
      '2026-02-10',
    ]);
  });

  it('is stable: equal keys keep input (server newest-first) order, and does not mutate input', () => {
    const tie = [row({ date: '2026-05-02', kcal: 2000 }), row({ date: '2026-05-01', kcal: 2000 })];
    expect(dates(sortRows(tie, 'kcal', 'asc'))).toEqual(['2026-05-02', '2026-05-01']);
    expect(dates(rows)).toEqual(['2026-03-01', '2026-01-15', '2026-02-10']);
  });
});
