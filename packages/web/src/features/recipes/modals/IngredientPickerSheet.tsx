import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import { SearchSheet, type SearchSheetItem } from '../../../components/SearchSheet';
import { useLoggableSearch } from '../useRecipes';

// The ingredient picker on phones (MOB-1, specifications/screens/recipe.md §Interactions). Same
// results and same disabled rule as the desktop `IngredientSearch` — the presentation is the shared
// picker sheet, opened over the builder sheet (a nested overlay: the builder must stay mounted or
// its draft would be lost — design/components/modals.md §Nested overlays).
//
// Mounted only behind `useIsMobile()`, and never alongside `IngredientSearch`: that component closes
// on a document `mousedown` outside its own subtree, and this sheet is portalled to <body>, so the
// first tap inside the sheet would cancel the edit.
interface IngredientPickerSheetProps {
  /** The editing recipe's derived food id — disabled to block direct self-reference. */
  disabledFoodId: string | null;
  /** True when swapping an existing line's item rather than appending one (drives the title). */
  replacing: boolean;
  /** Pre-fill the search with the line's current name (B-049 parity, edit mode). */
  initialQuery?: string;
  /** The current line's referenced id — marked as "current" in the list. */
  currentId?: string | null;
  onPick: (item: LoggableItem) => void;
  onClose: () => void;
}

export function IngredientPickerSheet({
  disabledFoodId,
  replacing,
  initialQuery,
  currentId,
  onPick,
  onClose,
}: IngredientPickerSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery ?? '');
  const search = useLoggableSearch(query, true);
  const results = search.data?.data ?? [];

  const items: SearchSheetItem[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.kind === 'recipe' ? { tag: t('recipes.builder.recipeTag') } : {}),
    disabled: r.id === disabledFoodId,
  }));

  return (
    <SearchSheet
      title={
        replacing ? t('recipes.builder.pickerTitleReplace') : t('recipes.builder.pickerTitleAdd')
      }
      placeholder={t('recipes.builder.searchPlaceholder')}
      emptyLabel={t('recipes.builder.searchEmpty')}
      query={query}
      onQueryChange={setQuery}
      items={items}
      currentId={currentId ?? null}
      // No custom option: the builder allows no custom-inline ingredients (recipe.md).
      onPick={(id) => {
        const picked = results.find((r) => r.id === id);
        if (picked) onPick(picked);
      }}
      onClose={onClose}
    />
  );
}
