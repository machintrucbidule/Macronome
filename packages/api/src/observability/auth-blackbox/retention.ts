// Bounding policy for the black box (B-231, owner decision): keep MAX_RECORDS lines in the
// current file, then roll it over to ONE archived generation — so ~2× MAX_RECORDS of history
// survives and a burst of attempts cannot instantly evict the interesting line, while the disk
// footprint stays a few hundred kilobytes on a volume the operator never has to manage.
//
// Pure decisions only; the file handling lives in store.ts.
export const MAX_RECORDS = 500;

export function shouldRotate(lineCount: number, max: number = MAX_RECORDS): boolean {
  return lineCount >= max;
}

/** Records in an existing file. Tolerates a missing trailing newline. */
export function countLines(text: string): number {
  if (text === '') return 0;
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return trimmed.split('\n').length;
}
