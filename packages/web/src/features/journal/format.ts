// Display helpers for the Journal screen (locale date formatting + integer rounding).
// Pure formatting — never a nutrition computation (CLAUDE.md rule 2).

/** Parse a YYYY-MM-DD string to a local Date (noon, to dodge DST edges). */
function parseIso(date: string): Date {
  const parts = date.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
}

/** Localised day label, e.g. "25 février 2026". */
export function formatJournalDate(date: string, locale: string): string {
  return parseIso(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Short weekday abbreviation, e.g. "mer.". */
export function formatDow(date: string, locale: string): string {
  return parseIso(date).toLocaleDateString(locale, { weekday: 'short' });
}

/** Year of a YYYY-MM-DD date. */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Current calendar year in the user's local timezone. */
export function currentYear(): number {
  return new Date().getFullYear();
}

/** Round to a whole number for display (calories/macros shown as integers). */
export function r0(value: number | null | undefined): number {
  return Math.round(value ?? 0);
}
