import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFoodRequest,
  FoodParseLabelRequest,
  UpdateFoodRequest,
} from '@macronome/shared';
import { foodsApi, type FoodListParams } from '../../api/foods';

// Data hooks for the Aliments screen. The page owns filter/sort state and passes it
// here; mutations invalidate the foods cache so the list refetches.
const FOODS_KEY = ['foods'] as const;

export function useFoodsList(params: FoodListParams) {
  return useQuery({
    queryKey: [...FOODS_KEY, params],
    queryFn: () => foodsApi.list(params),
  });
}

export function useFoodMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: FOODS_KEY });

  const create = useMutation({
    mutationFn: (body: CreateFoodRequest) => foodsApi.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (vars: { id: string; body: UpdateFoodRequest }) =>
      foodsApi.update(vars.id, vars.body),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (id: string) => foodsApi.archive(id),
    onSuccess: invalidate,
  });
  const restore = useMutation({
    mutationFn: (id: string) => foodsApi.restore(id),
    onSuccess: invalidate,
  });

  return { create, update, archive, restore };
}

/** Macro-label parser (PM-1/B-114): paste nutrition text → per-100 g macros. Stateless,
 * so a plain mutation (no cache to invalidate). */
export function useParseLabel() {
  return useMutation({
    mutationFn: (body: FoodParseLabelRequest) => foodsApi.parseLabel(body),
  });
}
