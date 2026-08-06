import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRecipeRequest,
  RecipePreviewRequest,
  UpdateRecipeRequest,
} from '@macronome/shared';
import { recipesApi, type RecipeListParams } from '../../api/recipes';
import { notifyUndoable } from '../../components/Toast/notify';
import { loggableSearchApi } from '../../api/loggableSearch';
import { LIST_GC_TIME } from '../../lib/listCache';
import { draftToPreviewBody, type RecipeDraft } from './modals/draft';

// Data hooks for the Recettes screen. The page owns search/sort state and passes it
// here; mutations invalidate the recipes cache so the list refetches.
const RECIPES_KEY = ['recipes'] as const;

// LL-1/B-122: the list lazy-loads by keyset cursor (the API caps a page at 50). Each
// page appends; the page flattens `data.pages`. The query key keeps the `RECIPES_KEY`
// prefix, so the mutation invalidations below still match and refetch all loaded pages.
export function useRecipesList(params: RecipeListParams) {
  return useInfiniteQuery({
    queryKey: [...RECIPES_KEY, params],
    queryFn: ({ pageParam }) =>
      recipesApi.list(pageParam ? { ...params, cursor: pageParam } : params),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    // B-268: keep the pages the user scrolled through while they step into a recipe and back.
    // With the default 5-minute GC only page 1 remains on Back, so the list is shorter than the
    // saved scroll offset and the restore is clamped near the top. Scoped to this list, not the
    // global default: nothing else accumulates pages this way.
    gcTime: LIST_GC_TIME,
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(id as string),
    enabled: id !== null,
  });
}

/**
 * Live derived figures for the builder's yield panel (B-035). The web never computes
 * nutrition figures (CLAUDE.md rule 2): it posts the unsaved draft (debounced) to the
 * stateless preview endpoint and renders what comes back. Disabled until a line is ready
 * to compute; the previous figures are kept while a recompute is in flight.
 */
export function useRecipePreview(draft: RecipeDraft) {
  const key = JSON.stringify(draftToPreviewBody(draft));
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedKey(key), 300);
    return () => clearTimeout(id);
  }, [key]);
  const body = useMemo(() => JSON.parse(debouncedKey) as RecipePreviewRequest, [debouncedKey]);
  return useQuery({
    queryKey: ['recipePreview', debouncedKey],
    queryFn: () => recipesApi.preview(body),
    enabled: body.ingredients.length > 0,
    placeholderData: (prev) => prev,
    select: (res) => res.data,
  });
}

/** Combined food∪recipe search for the ingredient picker. */
export function useLoggableSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['loggable', query],
    queryFn: () => loggableSearchApi.search(query),
    enabled,
    staleTime: 30_000,
  });
}

export function useRecipeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: RECIPES_KEY });

  const create = useMutation({
    mutationFn: (body: CreateRecipeRequest) => recipesApi.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (vars: { id: string; body: UpdateRecipeRequest }) =>
      recipesApi.update(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      void invalidate();
      void qc.invalidateQueries({ queryKey: ['recipe', vars.id] });
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => recipesApi.archive(id),
    // B-261: exactly reversible, same id (see useFoods).
    onSuccess: (_data, id) => {
      void invalidate();
      notifyUndoable('recipeArchived', async () => {
        await recipesApi.restore(id);
        await invalidate();
      });
    },
  });
  const restore = useMutation({
    mutationFn: (id: string) => recipesApi.restore(id),
    onSuccess: invalidate,
  });

  return { create, update, archive, restore };
}
