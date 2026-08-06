// Ciqual `teneur` (published value) parsing — spec/logic/ciqual-catalog.md §3.
//
// A published composition value is one of four forms; decimals use a COMMA, values are
// space-padded, and scientific notation shows up on a handful of trace constituents:
//
//   ' 12,5 ' / ' 1140 '  measured        → the number
//   ' traces '           below quantif.  → 0
//   ' < 0,01 '           below the LOQ   → 0   (any threshold, including '< 0')
//   ' - '                not measured    → unknown
//
// "Unknown" is a third state, distinct from 0: §4 keeps a food whose macro is unmeasured
// but drops one whose energy is, so the two must not collapse. Pure function.

/** Sentinel for "not measured" — the caller must branch on it, not treat it as 0. */
export const TENEUR_UNKNOWN = null;

const NOT_MEASURED = '-';
const TRACES = 'traces';
const BELOW_LOQ = /^<\s*/;

/**
 * Parse one raw `<teneur>` text into a number, or `null` when the value is not measured.
 * Returns `null` as well for anything unrecognised — an unreadable value is treated as
 * unmeasured rather than silently becoming 0.
 */
export function parseTeneur(raw: string): number | null {
  const value = raw.trim();
  if (value === '' || value === NOT_MEASURED) return TENEUR_UNKNOWN;
  if (value.toLowerCase() === TRACES) return 0;
  // Below the limit of quantification: the threshold itself carries no information about
  // how much is present, only that it is negligible.
  if (BELOW_LOQ.test(value)) return 0;

  // Comma decimals; a few trace figures are published as `1E-6`.
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : TENEUR_UNKNOWN;
}
