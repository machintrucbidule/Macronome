import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  type AutocompleteItem,
} from '../../../../components/Form/Autocomplete/Autocomplete';
import { useMeals } from '../../MealsContext';
import { useFoodSearch } from '../../hooks/useFoodLookup';
import { usePickLoggable } from '../../../foods/usePickLoggable';

// Inline food picker shown in the name cell while editing a line. Searches foods ∪ recipes
// (server-side `/search/loggable`), maps results to the shared Autocomplete, and routes a
// pick → add/replace entry, "+ Valeurs manuelles" → CustomFoodModal. The per-100 g kcal meta
// is not shown here (the combined search omits macros by contract); restore in M9 polish.
interface InlineFoodSearchProps {
  mealId: string;
  mealIndex: number;
  entryId: string | null;
  /** Target row for a new line (B-028); ignored when re-picking an existing entry. */
  orderIndex?: number | null;
  initialName: string;
  currentFoodId: string | null;
}

export function InlineFoodSearch({
  mealId,
  mealIndex,
  entryId,
  orderIndex,
  initialName,
  currentFoodId,
}: InlineFoodSearchProps) {
  const { t } = useTranslation();
  const { actions, editing } = useMeals();
  // Type-to-search (B-105): when the picker was opened by typing on the focused name, seed the
  // query with that character (caret kept at the end); otherwise seed with the current name.
  const seed = editing?.initialQuery;
  const [query, setQuery] = useState(seed ?? initialName);
  const wrapRef = useRef<HTMLDivElement>(null);
  const search = useFoodSearch(query, true);

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) actions.closeEdit();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actions]);

  const { resolve } = usePickLoggable();

  const items: AutocompleteItem[] = useMemo(
    () =>
      (search.data?.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        ...(item.kind === 'recipe'
          ? { tag: t('meals.tag.recipe') }
          : item.named_portions.length
            ? { tag: t('meals.tag.portion') }
            : {}),
        // Ciqual entries are not yours yet — picking one adopts it first (B-293).
        ...(item.origin === 'ciqual_ref' ? { hint: t('foods.source.ciqual') } : {}),
      })),
    [search.data, t],
  );

  return (
    <div ref={wrapRef}>
      <Autocomplete
        query={query}
        onQueryChange={setQuery}
        items={items}
        currentId={currentFoodId}
        emptyLabel={t('meals.search.empty')}
        customOptionLabel={t('meals.search.custom')}
        placeholder={t('meals.search.placeholder')}
        onPick={(item) => {
          const hit = search.data?.data.find((f) => f.id === item.id);
          if (!hit) return;
          // A Ciqual entry is adopted first; `resolve` hands back a real food either way (B-293).
          void resolve(hit).then((picked) =>
            actions.pickFood(
              { mealId, mealIndex, entryId, orderIndex: orderIndex ?? null },
              picked.id,
              // Default-unit-on-add (B-109): the loggable item already carries its named portions
              // in memory; pass them so the new line defaults to a portion, not g.
              picked.named_portions,
            ),
          );
        }}
        onCustom={() => actions.openCustom(mealId, mealIndex, entryId, orderIndex)}
        onClose={actions.closeEdit}
        selectOnMount={seed == null}
        pickOnTab
      />
    </div>
  );
}
