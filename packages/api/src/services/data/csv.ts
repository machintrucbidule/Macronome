// Pure CSV serialization (RFC 4180): comma-delimited, CRLF rows. A field is quoted only when it
// contains a comma, a double-quote or a newline; inner quotes are doubled. null/undefined → an
// empty cell; numbers render via String() (dot decimal). No business logic — used by the per-page
// CSV exports (EX-1 / B-132), whose values are canonical (English headers, OK/NOK, activity keys).

export type CsvCell = string | number | null | undefined;

/** Quote+escape a single cell per RFC 4180 (only when it carries a delimiter/quote/newline). */
function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  const s = String(cell);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize a header row + data rows to a CSV string (CRLF line endings). */
export function toCsv(headers: readonly string[], rows: readonly CsvCell[][]): string {
  return [headers, ...rows].map((cells) => cells.map(escapeCell).join(',')).join('\r\n');
}
