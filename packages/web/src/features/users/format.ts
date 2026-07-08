// Timestamp display for the Utilisateurs table (screens/users.md). Locale-aware
// datetime (same recipe as the integrations measured-at stamp); null → em dash
// (never logged in / no recorded activity).
export function formatInstant(iso: string | null, language: string): string {
  if (!iso) return '—';
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
