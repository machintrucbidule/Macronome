import { useMemo, useState } from 'react';
import type { EntryUnit, Meal } from '@macronome/shared';
import { useFoodSearch } from '../../hooks/useFoodLookup';
import { diffCookLines } from '../../logic/cookDiff';
import type { CookEdit } from '../../hooks/mealActions';

// Cook-mode working copy (specifications/screens/meals.md §Cook mode): edits live in memory on a
// clone of the meal's lines until Valider. Holds the selected line, the input mode (idle/qty/name),
// the numeric buffer and the search query. `apply()` diffs the copy vs the originals and yields the
// per-line entry patches; the controller dispatches them. No nutrition is computed here.
export type CookMode = 'idle' | 'qty' | 'name';

export interface CookLine {
  id: string;
  kind: 'referenced' | 'custom';
  food_id: string | null;
  custom_name: string | null;
  served_quantity: number;
  unit: EntryUnit;
  portion_id: string | null;
  served_grams: number | null;
}

const toLine = (e: Meal['entries'][number]): CookLine => ({
  id: e.id,
  kind: e.kind,
  food_id: e.food_id,
  custom_name: e.custom_name,
  served_quantity: e.served_quantity,
  unit: e.unit,
  portion_id: e.portion_id,
  served_grams: e.served_grams,
});

export function useCookSession(meal: Meal) {
  const original = useMemo(() => meal.entries.map(toLine), [meal.entries]);
  const [lines, setLines] = useState<CookLine[]>(original);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CookMode>('idle');
  const [buffer, setBuffer] = useState('');
  const [query, setQuery] = useState('');

  const search = useFoodSearch(query, mode === 'name');
  const results = mode === 'name' ? (search.data?.data ?? []) : [];

  const patch = (id: string, change: Partial<CookLine>): void =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)));

  const selectQty = (id: string): void => {
    setSelectedId(id);
    setMode('qty');
    setBuffer('');
  };
  const selectName = (id: string): void => {
    setSelectedId(id);
    setMode('name');
    setQuery('');
  };

  const typeDigit = (ch: string): void => {
    if (mode !== 'qty' || !selectedId) return;
    let next = buffer;
    if (ch === ',') {
      if (next.includes('.')) return;
      next = next === '' ? '0.' : `${next}.`;
    } else next += ch;
    setBuffer(next);
    const v = parseFloat(next);
    patch(selectedId, { served_quantity: Number.isNaN(v) ? 0 : v });
  };

  const backspace = (): void => {
    if (mode === 'qty' && selectedId) {
      const next = buffer.slice(0, -1);
      setBuffer(next);
      const v = parseFloat(next);
      patch(selectedId, { served_quantity: Number.isNaN(v) ? 0 : v });
    } else if (mode === 'name') setQuery((q) => q.slice(0, -1));
  };

  const typeChar = (ch: string): void => setQuery((q) => q + ch);

  const setUnit = (id: string, unit: EntryUnit, portion_id: string | null): void =>
    patch(id, { unit, portion_id });

  const pickFood = (foodId: string): void => {
    if (!selectedId) return;
    patch(selectedId, { food_id: foodId, unit: 'g', portion_id: null });
    setMode('idle');
  };

  const displayQty = (line: CookLine): string => {
    if (line.kind === 'custom') return String(line.served_grams ?? 0);
    if (selectedId === line.id && mode === 'qty' && buffer !== '') return buffer.replace('.', ',');
    return String(line.served_quantity);
  };

  const diff = (): CookEdit[] => diffCookLines(original, lines);

  return {
    lines,
    selectedId,
    mode,
    query,
    results,
    displayQty,
    selectQty,
    selectName,
    typeDigit,
    typeChar,
    backspace,
    setUnit,
    pickFood,
    diff,
  };
}

export type CookSession = ReturnType<typeof useCookSession>;
