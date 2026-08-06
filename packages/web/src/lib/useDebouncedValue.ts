import { useEffect, useState } from 'react';

/** Search-as-you-type delay, shared so the lists and the Chronodrive search agree (LD-1/B-303). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Returns `value` after it has been stable for `delayMs` (search-as-you-type). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
