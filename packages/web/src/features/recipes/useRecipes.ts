import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRecipeRequest, UpdateRecipeRequest } from '@macronome/shared';
import { recipesApi, type RecipeListParams } from '../../api/recipes';
import { loggableSearchApi } from '../../api/loggableSearch';

// Data hooks for the Recettes screen. The page owns search/sort state and passes it
// here; mutations invalidate the recipes cache so the list refetches.
const RECIPES_KEY = ['recipes'] as const;

export function useRecipesList(params: RecipeListParams) {
  return useQuery({
    queryKey: [...RECIPES_KEY, params],
    queryFn: () => recipesApi.list(params),
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(id as string),
    enabled: id !== null,
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
    onSuccess: invalidate,
  });
  const restore = useMutation({
    mutationFn: (id: string) => recipesApi.restore(id),
    onSuccess: invalidate,
  });

  return { create, update, archive, restore };
}
