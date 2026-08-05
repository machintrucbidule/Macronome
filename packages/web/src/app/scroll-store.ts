// Where each screen was scrolled to (B-268, corrected by B-277). Pure and in-memory by design:
// the owner declined persisting anything across sessions, so this dies with the tab.
//
// Keyed on the **pathname**, not react-router's `location.key`. Keying on the history entry only
// restored on a browser Back/Forward, which is not how the app is used: a food's detail is a
// modal, not a route, so returning to Aliments means clicking the nav — a PUSH, which used to
// land at the top. Per screen, "come back where I was" holds however you got there.
const offsets = new Map<string, number>();

export function saveOffset(path: string, y: number): void {
  offsets.set(path, y);
}

/**
 * The offset to restore for `path`: where it was left in this session, or the top for a screen
 * not visited yet. A first visit therefore still opens at the top, as it should.
 */
export function offsetFor(path: string): number {
  return offsets.get(path) ?? 0;
}

/** Test seam — the map is module state, so a test must be able to empty it. */
export function clearOffsets(): void {
  offsets.clear();
}
