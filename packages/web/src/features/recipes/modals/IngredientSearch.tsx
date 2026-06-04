import { useState } from 'react';
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
  onPick: (item: LoggableItem) => void;
  onClose: () => void;
}

export function IngredientSearch({ disabledFoodId, onPick, onClose }: IngredientSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const search = useLoggableSearch(query, true);
  const results = search.data?.data ?? [];

  const items: AutocompleteItem[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.kind === 'recipe' ? { tag: t('recipes.builder.recipeTag') } : {}),
    disabled: r.id === disabledFoodId,
  }));
  const byId = new Map(results.map((r) => [r.id, r]));

  return (
    <Autocomplete
      query={query}
      onQueryChange={setQuery}
      items={items}
      emptyLabel={t('recipes.builder.searchEmpty')}
      placeholder={t('recipes.builder.searchPlaceholder')}
      onPick={(it) => {
        const picked = byId.get(it.id);
        if (picked) onPick(picked);
      }}
      onClose={onClose}
    />
  );
}
