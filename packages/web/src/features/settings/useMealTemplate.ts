import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMealTemplateRequest, PatchMealTemplateRequest } from '@macronome/shared';
import { mealTemplateApi } from '../../api/mealTemplate';

// Meal-template data hooks (spec/api §Settings). The ordered default day structure; every
// mutation invalidates the list so the editor reflects the new order/names.
const TEMPLATE_KEY = ['meal-template'] as const;

export function useMealTemplate() {
  return useQuery({ queryKey: TEMPLATE_KEY, queryFn: () => mealTemplateApi.list() });
}

export function useMealTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: TEMPLATE_KEY });
  return {
    create: useMutation({
      mutationFn: (body: CreateMealTemplateRequest) => mealTemplateApi.create(body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (vars: { id: string; body: PatchMealTemplateRequest }) =>
        mealTemplateApi.update(vars.id, vars.body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => mealTemplateApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
