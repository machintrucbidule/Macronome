import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFoodRequest,
  Food,
  FoodParseLabelRequest,
  FoodSource,
  UpdateFoodRequest,
} from '@macronome/shared';
import { foodsApi, type FoodListParams } from '../../api/foods';
import { notifyUndoable } from '../../components/Toast/notify';
import { usePagedList, type PagedList } from '../../lib/usePagedList';

// Data hooks for the Aliments screen. The page owns filter/sort state and passes it
// here; mutations invalidate the foods cache so the list refetches.
const FOODS_KEY = ['foods'] as const;

// LL-1/B-122, re-paged by row offset in LD-1/B-303: pages are held in a map keyed by page index,
// so the page under the scrollbar can be fetched without walking the ones before it. The query key
// keeps the `FOODS_KEY` prefix, so the mutation invalidations below still match every loaded page.
// `sources` rides on each page's envelope alongside `total`, so the toolbar reads it from whichever
// page answered first.
export interface FoodsPage extends PagedList<Food> {
  sources: FoodSource[];
}

export function useFoodsList(params: FoodListParams): FoodsPage {
  const sources = useRef<FoodSource[]>([]);
  const paged = usePagedList<Food>({
    queryKey: [...FOODS_KEY, params],
    fetchPage: async (offset, limit) => {
      const res = await foodsApi.list({ ...params, offset, limit });
      sources.current = res.sources;
      return { data: res.data, total: res.total };
    },
  });
  return { ...paged, sources: sources.current };
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
    // B-261: archiving is exactly reversible — `restore` brings the food back with the SAME id,
    // so the undo is faithful, not a re-creation.
    onSuccess: (_data, id) => {
      void invalidate();
      notifyUndoable('foodArchived', async () => {
        await foodsApi.restore(id);
        await invalidate();
      });
    },
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
