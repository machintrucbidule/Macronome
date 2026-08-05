// Where each history entry was scrolled to (B-268). Pure and in-memory by design: the owner
// declined persisting anything across sessions, so this dies with the tab.
//
// Keyed on react-router's `location.key`, not the pathname: the same screen visited twice sits at
// two different places in the history and must restore to two different offsets.
const offsets = new Map<string, number>();

export type NavKind = 'POP' | 'PUSH' | 'REPLACE';

export function saveOffset(key: string, y: number): void {
  offsets.set(key, y);
}

/**
 * The offset to restore for `key`. Only a **POP** (browser back/forward) returns to a remembered
 * place; a PUSH/REPLACE opens a screen, which always starts at the top — today those silently
 * inherit the previous screen's offset, which is its own small bug.
 */
export function offsetFor(key: string, kind: NavKind): number {
  if (kind !== 'POP') return 0;
  return offsets.get(key) ?? 0;
}

/** Test seam — the map is module state, so a test must be able to empty it. */
export function clearOffsets(): void {
  offsets.clear();
}
