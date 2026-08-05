import { expect, test } from 'vitest';
import type { JournalRow } from '@macronome/shared';
import { toCsv } from './csv.js';
import { journalRowToCells, weighInToCells } from './export-csv.js';

// EX-1 / B-132 — pure CSV serializer + per-row field mappers (standard CSV, English headers,
// canonical values). The async builders' all-years / full-history reads are covered by the
// integration test; here we lock the serialization contract.

test('toCsv joins a header + rows with CRLF', () => {
  const csv = toCsv(
    ['a', 'b'],
    [
      ['1', '2'],
      ['3', '4'],
    ],
  );
  expect(csv).toBe('a,b\r\n1,2\r\n3,4');
});

test('toCsv quotes only cells with a comma, quote or newline (inner quotes doubled)', () => {
  const csv = toCsv(['h'], [['plain'], ['a,b'], ['say "hi"'], ['line\nbreak']]);
  expect(csv).toBe('h\r\nplain\r\n"a,b"\r\n"say ""hi"""\r\n"line\nbreak"');
});

test('toCsv renders null/undefined as an empty cell and numbers with a dot decimal', () => {
  expect(toCsv(['a', 'b', 'c'], [[null, undefined, 72.5]])).toBe('a,b,c\r\n,,72.5');
});

function journalRow(over: Partial<JournalRow>): JournalRow {
  return {
    date: '2026-03-01',
    kcal: 2000,
    macros: { L: 70, G: 200, P: 120 },
    verdict_auto: 'OK',
    verdict_override: null,
    effective_verdict: 'OK',
    kcal_gap: null,
    burn_gap: null,
    activity_level: 'sedentary',
    comment: null,
    kind: 'detailed',
    state: 'green',
    tone: 'ok',
    editable_kcal: false,
    ...over,
  };
}

test('journalRowToCells emits [date, kcal, fat, carb, protein, verdict, activity, comment], rounded', () => {
  const cells = journalRowToCells(
    journalRow({
      kcal: 1999.6,
      macros: { L: 70.4, G: 200.5, P: 119.9 },
      effective_verdict: 'NOK',
      activity_level: 'very_active',
      comment: 'cheat day',
    }),
  );
  expect(cells).toEqual(['2026-03-01', 2000, 70, 201, 120, 'NOK', 'very_active', 'cheat day']);
});

test('journalRowToCells blanks macros for a no-macro (summary) day and a null verdict/comment', () => {
  const cells = journalRowToCells(
    journalRow({ macros: null, effective_verdict: null, comment: null }),
  );
  expect(cells).toEqual(['2026-03-01', 2000, null, null, null, '', 'sedentary', null]);
});

test('weighInToCells emits [date, weight, waist, diet_flag, note] with canonical flag', () => {
  const cells = weighInToCells({
    date: new Date('2026-03-01T00:00:00.000Z'),
    weightKg: 72.5,
    waistCm: 80,
    dietFlag: 'in_diet',
    note: 'morning',
  });
  expect(cells).toEqual(['2026-03-01', 72.5, 80, 'in_diet', 'morning']);
});

test('weighInToCells blanks a null waist and note', () => {
  const cells = weighInToCells({
    date: new Date('2026-03-02T00:00:00.000Z'),
    weightKg: 71.8,
    waistCm: null,
    dietFlag: 'not_in_diet',
    note: null,
  });
  expect(cells).toEqual(['2026-03-02', 71.8, null, 'not_in_diet', null]);
});
