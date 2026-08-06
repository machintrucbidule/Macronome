import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import { SearchSheet, type SearchSheetItem } from '../../../components/SearchSheet';
import { useLoggableSearch } from '../useRecipes';
import { usePickLoggable } from '../../foods/usePickLoggable';

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

  const { resolveItem } = usePickLoggable();

  const items: SearchSheetItem[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.kind === 'recipe' ? { tag: t('recipes.builder.recipeTag') } : {}),
    // Ciqual entries are not yours yet — picking one adopts it first (B-293).
    ...(r.origin === 'ciqual_ref' ? { hint: t('foods.source.ciqual') } : {}),
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
      onPick={(item) => {
        const picked = results.find((r) => r.id === item.id);
        // A Ciqual entry becomes a real food before it can be an ingredient (B-293).
        if (picked) void resolveItem(picked).then(onPick);
      }}
      onClose={onClose}
    />
  );
}
