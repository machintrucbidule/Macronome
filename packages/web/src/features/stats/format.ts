// Display helpers for the Stats screen (locale formatting + integer rounding). Pure
// formatting — never a nutrition computation (CLAUDE.md rule 2). The server sends full
// precision; rounding happens here at render (spec/logic/00-conventions.md §Rounding).

/** Current calendar year in the user's local timezone. */
export function currentYear(): number {
  return new Date().getFullYear();
}

/** Round to a whole number for display (kcal shown as integers); null → "—". */
export function r0(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(Math.round(value));
}

/** A 0–1 rate as an integer percent; null → "—". */
export function pct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`;
}

/** Short localized month label for a 1–12 month number, e.g. "mai". */
export function monthLabel(month: number, locale: string): string {
  return new Date(2020, month - 1, 1).toLocaleDateString(locale, { month: 'short' });
}

/** Localized full date for a YYYY-MM-DD string, e.g. "2 juin 2026". */
export function formatDate(date: string, locale: string): string {
  const p = date.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Localized "month YYYY" for a YYYY-MM key, e.g. "juin 2026". */
export function monthKeyLabel(ym: string, locale: string): string {
  const p = ym.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}
