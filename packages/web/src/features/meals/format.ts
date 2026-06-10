// Display helpers for the Repas screen (rounding per spec/logic/00-conventions.md; locale
// date formatting). Pure formatting — never a nutrition computation.
import { effectiveTodayIso } from '../../lib/effectiveDay';

/** The default day to open: the calendar date, or the previous one before 03:00 (display-only
 *  rollover, DB-1 / B-134). The user can still navigate to the real calendar date. */
export function todayIso(): string {
  return effectiveTodayIso();
}

/** Parse a YYYY-MM-DD string to a local Date (noon, to dodge DST edges). */
export function parseIso(date: string): Date {
  const parts = date.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
}

/** Shift a YYYY-MM-DD date by a number of days, returning YYYY-MM-DD. */
export function shiftIso(date: string, days: number): string {
  const d = parseIso(date);
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Long, localised day label, e.g. "samedi 30 mai 2026". */
export function formatDateLabel(date: string, locale: string): string {
  return parseIso(date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Compact day label for the mobile day bar (mobile-responsive S4): short weekday + day + month
 *  + 2-digit year, e.g. fr "mar. 10 juin 26". Desktop keeps the long label above. */
export function formatDateLabelShort(date: string, locale: string): string {
  return parseIso(date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: '2-digit',
  });
}

/** Round to a whole number for display (totals/macros shown as integers). */
export function r0(value: number | null | undefined): number {
  return Math.round(value ?? 0);
}
