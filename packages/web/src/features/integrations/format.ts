// Display formatting for integration results (presentation only — the values come from
// the server proxies; the web computes no nutrition figure here).

/** ISO datetime → localized "date, hh:mm" for the HA measurement hints. */
export function formatMeasuredAt(iso: string, language: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
