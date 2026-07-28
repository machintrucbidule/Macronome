import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchSheet, type SearchSheetItem } from '../../../../components/SearchSheet';
import { useMeals } from '../../MealsContext';
import { useFoodSearch } from '../../hooks/useFoodLookup';
import type { EditTarget } from '../../hooks/mealActions';

// Mobile-only food picker (spec §5.3). Replaces the inline autocomplete on phones: a search field +
// a tappable result list (foods ∪ recipes via `/search/loggable`), shown as a bottom sheet (owner
// refinement 2026-06-11 — same anchor as the other meal sheets). A pick routes through
// `actions.pickFood` (add/replace), "+ Valeurs manuelles" → `actions.openCustom`; both close the
// editing state, unmounting this sheet. Rendered from MealsOverlays only when `useIsMobile()` —
// desktop keeps the inline picker untouched. Search-only by owner decision (no "recents": the app
// has no recently-logged source).
//
// Since MOB-1 this is a thin adapter over the shared `SearchSheet`, which the recipe-builder and
// garde-manger pickers also host: it keeps the meals-specific parts (the context, the `EditTarget`
// plumbing, the `meals.*` wording) and the sheet owns the presentation. Behaviour here is unchanged.
export function FoodPickerSheet({ target }: { target: EditTarget }) {
  const { t } = useTranslation();
  const { actions, day } = useMeals();
  const [query, setQuery] = useState(target.initialQuery ?? '');
  const search = useFoodSearch(query, true);
  const results = search.data?.data ?? [];

  // Outline the line's current food when replacing (parity with the inline picker's `currentId`).
  const currentFoodId = useMemo(() => {
    if (!target.entryId || !day) return null;
    const e = day.meals.flatMap((m) => m.entries).find((x) => x.id === target.entryId);
    return e?.food_id ?? null;
  }, [target.entryId, day]);

  const items: SearchSheetItem[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.kind === 'recipe'
      ? { tag: t('meals.tag.recipe') }
      : r.named_portions.length
        ? { tag: t('meals.tag.portion') }
        : {}),
  }));

  const pick = (id: string): void =>
    void actions.pickFood(
      {
        mealId: target.mealId,
        mealIndex: target.mealIndex,
        entryId: target.entryId,
        orderIndex: target.orderIndex ?? null,
      },
      id,
      results.find((r) => r.id === id)?.named_portions,
    );

  return (
    <SearchSheet
      title={target.entryId ? t('meals.picker.titleReplace') : t('meals.picker.titleAdd')}
      placeholder={t('meals.search.placeholder')}
      emptyLabel={t('meals.search.empty')}
      query={query}
      onQueryChange={setQuery}
      items={items}
      currentId={currentFoodId}
      customLabel={t('meals.search.custom')}
      onCustom={() =>
        actions.openCustom(target.mealId, target.mealIndex, target.entryId, target.orderIndex)
      }
      onPick={pick}
      onClose={actions.closeEdit}
    />
  );
}
