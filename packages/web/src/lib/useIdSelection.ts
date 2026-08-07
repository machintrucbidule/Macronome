import { useEffect, useState } from 'react';

/**
 * The rows a catalogue screen has ticked for a batch edit (BE-1).
 *
 * Modelled on `features/meals/hooks/useMealSelection.ts` but **without its mode flag**: the
 * checkboxes here are permanent, so there is nothing to enter or leave. It holds ids and nothing
 * else — the rows themselves are paginated and mostly not in memory, which is the whole reason
 * "select everything matching the filter" is a server round trip (`GET /<resource>/ids`, D10).
 *
 * `filterKey` is what the selection belongs to. When it changes — a new search, a new filter, the
 * other list mode — the selection is dropped: a set frozen against one filter must not survive
 * into another. A change of **sort** deliberately does not clear it, since the matching set is the
 * same rows in a different order.
 */
export interface IdSelection {
  selected: Set<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Replace the whole selection — what the header checkbox does with the ids it fetched. */
  setAll: (ids: string[]) => void;
  clear: () => void;
}

export function useIdSelection(filterKey: string): IdSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set()));
  }, [filterKey]);

  return {
    selected,
    count: selected.size,
    isSelected: (id) => selected.has(id),
    toggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (ids) => setSelected(new Set(ids)),
    clear: () => setSelected(new Set()),
  };
}
