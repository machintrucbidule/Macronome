import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  type AutocompleteItem,
} from '../../../../components/Form/Autocomplete/Autocomplete';
import { useMeals } from '../../MealsContext';
import { useFoodSearch } from '../../hooks/useFoodLookup';
import { r0 } from '../../format';

// Inline food picker shown in the name cell while editing a line. Searches the foods catalog
// (server-side; `/search/loggable` with recipes arrives in M5), maps results to the shared
// Autocomplete, and routes a pick → add/replace entry, "+ Valeurs manuelles" → CustomFoodModal.
interface InlineFoodSearchProps {
  mealId: string;
  mealIndex: number;
  entryId: string | null;
  initialName: string;
  currentFoodId: string | null;
}

export function InlineFoodSearch({
  mealId,
  mealIndex,
  entryId,
  initialName,
  currentFoodId,
}: InlineFoodSearchProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [query, setQuery] = useState(initialName);
  const wrapRef = useRef<HTMLDivElement>(null);
  const search = useFoodSearch(query, true);

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) actions.closeEdit();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actions]);

  const items: AutocompleteItem[] = useMemo(
    () =>
      (search.data?.data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        meta: `${r0(f.kcal_per_100g)} kcal /100g`,
        ...(f.named_portions.length ? { tag: t('meals.tag.portion') } : {}),
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
        onPick={(item) => void actions.pickFood({ mealId, mealIndex, entryId }, item.id)}
        onCustom={() => actions.openCustom(mealId, mealIndex, entryId)}
        onClose={actions.closeEdit}
      />
    </div>
  );
}
