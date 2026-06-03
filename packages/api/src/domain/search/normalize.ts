// Diacritic-insensitive search key (spec/schema/indexes.md). The stored
// `normalized_name` is maintained by this helper on every write; autocomplete
// matches on it via the pg_trgm GIN index. It is the app-side parity of Postgres
// `unaccent(lower(name))`: accented and plain spellings collapse to one key, so
// "crème" ≈ "creme" and "œuf" ≈ "oeuf".
//
// Pure function: plain string in, plain string out (no DB, no request).

/** Ligatures Unicode NFD does not split; folded explicitly. */
const LIGATURES: Record<string, string> = {
  œ: 'oe',
  Œ: 'oe',
  æ: 'ae',
  Æ: 'ae',
  ß: 'ss',
};

const COMBINING_MARKS = /[̀-ͯ]/g;
const LIGATURE_CHARS = /[œŒæÆß]/g;

/** Build the diacritic-insensitive, lower-cased, whitespace-collapsed search key. */
export function normalize(name: string): string {
  const folded = name.replace(LIGATURE_CHARS, (ch) => LIGATURES[ch] ?? ch);
  return folded
    .normalize('NFD') // split base letters from combining diacritics
    .replace(COMBINING_MARKS, '') // drop the combining marks
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
