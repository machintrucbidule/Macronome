// Id remap for undo/redo (UR-1 / B-133). Re-creating a deleted line (undo of a remove, or redo
// of an add) yields a NEW server id. This map translates an op's original id to the live one so
// later/earlier ops resolve correctly across arbitrary undo/redo sequences. Owned by
// useMealHistory and cleared on date change.

export interface IdMap {
  /** Follow old→new links to the live id (identity when unmapped); cycle-guarded. Declared as a
   *  property (not a method) so it can be passed by reference without `this` binding concerns. */
  resolve: (id: string) => string;
  /** Record that `oldId` is now `newId` (written when the reconciler resurrects a line). */
  remap: (oldId: string, newId: string) => void;
  clear: () => void;
}

export function createIdMap(): IdMap {
  const map = new Map<string, string>();
  const resolve = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (map.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = map.get(cur) as string;
    }
    return cur;
  };
  return {
    resolve,
    remap: (oldId, newId) => {
      map.set(oldId, newId);
    },
    clear: () => map.clear(),
  };
}
