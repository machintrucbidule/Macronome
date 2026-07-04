import { useMutation, useQuery } from '@tanstack/react-query';
import { integrationsApi } from '../../api/integrations';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

// Data hooks for the Chronodrive search dialog (B-182). The query keys on the DEBOUNCED
// string (300 ms, matching the recipe-preview pattern) and only fires at ≥ 3 chars
// (spec §8.1); placeholderData keeps the previous rows visible while typing
// (anti-flicker, same as useRecipePreview).
export function useChronoSearch(q: string) {
  const debounced = useDebouncedValue(q.trim(), 300);
  return useQuery({
    queryKey: ['chrono', 'search', debounced],
    queryFn: () => integrationsApi.searchProducts(debounced),
    enabled: debounced.length >= 3,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    retry: false,
    select: (res) => res.data,
  });
}

/** The "Choisir" step: fetch the product detail (with its server-side food_prefill). */
export function useChronoProduct() {
  return useMutation({ mutationFn: (id: string) => integrationsApi.getProduct(id) });
}
