import type { JournalRow } from '@macronome/shared';
import { weightRepo } from '../../data/repositories/weight.repo.js';
import { listAllLogged } from '../journal.js';
import { toCsv, type CsvCell } from './csv.js';

// Per-page CSV export (EX-1 / B-132): a Journal recap (one row per logged day, all years) and the
// full weigh-in history. Standard CSV, English headers, canonical values (verdict OK/NOK, activity
// key, diet flag). Reuses the existing day/weigh-in reads — it formats, it never recomputes.

const JOURNAL_HEADERS = [
  'date',
  'calories_kcal',
  'fat_g',
  'carb_g',
  'protein_g',
  'verdict',
  'activity',
  'comment',
] as const;

const WEIGHT_HEADERS = ['date', 'weight_kg', 'waist_cm', 'diet_flag', 'note'] as const;

const num = (d: { toString(): string }): number => Number(d.toString());
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Minimal weigh-in shape the CSV needs (the Prisma `WeightEntry` model satisfies it). */
interface WeighInRow {
  date: Date;
  weightKg: { toString(): string };
  waistCm: { toString(): string } | null;
  dietFlag: string;
  note: string | null;
}

/** Journal day → CSV cells. Macros are L=fat, G=carb, P=protein; kcal/macros rounded like the
 *  screen (`r0`). Empty (no-macro) days leave the macro cells blank; verdict null → blank. */
export function journalRowToCells(r: JournalRow): CsvCell[] {
  return [
    r.date,
    Math.round(r.kcal),
    r.macros ? Math.round(r.macros.L) : null,
    r.macros ? Math.round(r.macros.G) : null,
    r.macros ? Math.round(r.macros.P) : null,
    r.effective_verdict ?? '',
    r.activity_level,
    r.comment,
  ];
}

/** Weigh-in → CSV cells (canonical values; weight/waist as stored, null waist/note → blank). */
export function weighInToCells(w: WeighInRow): CsvCell[] {
  return [
    isoDay(w.date),
    num(w.weightKg),
    w.waistCm === null ? null : num(w.waistCm),
    w.dietFlag,
    w.note,
  ];
}

/** Journal CSV — one recap row per logged day, all years, oldest first. */
export async function buildJournalCsv(userId: string): Promise<string> {
  const rows = await listAllLogged(userId);
  return toCsv(JOURNAL_HEADERS, rows.map(journalRowToCells));
}

/** Weigh-in CSV — the full history, oldest first. */
export async function buildWeightCsv(userId: string): Promise<string> {
  const entries = await weightRepo.findAll(userId);
  return toCsv(WEIGHT_HEADERS, entries.map(weighInToCells));
}
