import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import {
  Autocomplete,
  type AutocompleteItem,
} from '../../../components/Form/Autocomplete/Autocomplete';
import { useLoggableSearch } from '../useRecipes';

// Ingredient picker: autocomplete over foods AND recipes (spec/api §"Combined log search").
// The recipe being edited is shown disabled (self-reference); deeper transitive cycles are
// rejected by the server on save (the authoritative rule lives in domain/recipes).
interface IngredientSearchProps {
  /** The editing recipe's derived food id — disabled to block direct self-reference. */
  disabledFoodId: string | null;
  /** Pre-fill the search with the line's current name (B-049, edit mode). */
  initialQuery?: string;
  /** The current line's referenced id — outlined as "current" in the list. */
  currentId?: string | null;
  onPick: (item: LoggableItem) => void;
  onClose: () => void;
}

export function IngredientSearch({
  disabledFoodId,
  initialQuery,
  currentId,
  onPick,
  onClose,
}: IngredientSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery ?? '');
  const search = useLoggableSearch(query, true);
  const results = search.data?.data ?? [];

  // B-049: clicking outside the picker cancels the change and keeps the original line
  // (no onPick fires). Mirrors the outside-click pattern in UnitMenu.tsx.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const items: AutocompleteItem[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.kind === 'recipe' ? { tag: t('recipes.builder.recipeTag') } : {}),
    disabled: r.id === disabledFoodId,
  }));
  const byId = new Map(results.map((r) => [r.id, r]));

  return (
    <div ref={ref}>
      <Autocomplete
        query={query}
        onQueryChange={setQuery}
        items={items}
        currentId={currentId ?? null}
        emptyLabel={t('recipes.builder.searchEmpty')}
        placeholder={t('recipes.builder.searchPlaceholder')}
        onPick={(it) => {
          const picked = byId.get(it.id);
          if (picked) onPick(picked);
        }}
        onClose={onClose}
      />
    </div>
  );
}
