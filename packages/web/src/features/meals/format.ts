// Display helpers for the Repas screen (rounding per spec/logic/00-conventions.md; locale
// date formatting). Pure formatting — never a nutrition computation.

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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

/** Round to a whole number for display (totals/macros shown as integers). */
export function r0(value: number | null | undefined): number {
  return Math.round(value ?? 0);
}
