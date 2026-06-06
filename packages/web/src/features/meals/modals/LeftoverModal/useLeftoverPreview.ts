import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeftoverPreviewRequest } from '@macronome/shared';
import { leftoverApi } from '../../../../api/leftover';

// Live served → consumed preview for a draft leftover (B-047). Like useRecipePreview
// (features/recipes/useRecipes.ts): it debounces the request and posts it to the stateless
// preview endpoint — the proration runs on the server, never here (CLAUDE.md rule 2).
// `body` is null until the draft is computable (a selection + a gross weight); the query is
// then disabled and the table just shows nothing.
export function useLeftoverPreview(mealId: string, body: LeftoverPreviewRequest | null) {
  const key = body ? JSON.stringify(body) : '';
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedKey(key), 200);
    return () => clearTimeout(id);
  }, [key]);
  const enabled = debouncedKey !== '';
  const parsed = useMemo(
    () => (enabled ? (JSON.parse(debouncedKey) as LeftoverPreviewRequest) : null),
    [debouncedKey, enabled],
  );
  return useQuery({
    queryKey: ['leftoverPreview', mealId, debouncedKey],
    queryFn: () => leftoverApi.preview(mealId, parsed as LeftoverPreviewRequest),
    enabled,
    placeholderData: (prev) => prev,
  });
}
