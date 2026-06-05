import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateContainerRequest, UpdateContainerRequest } from '@macronome/shared';
import { containersApi } from '../../api/containers';

// Containers data hooks (spec/api §Settings). CRUD over the tare catalog; mutations
// invalidate the list. The locked built-in "Rien" is enforced server-side.
const CONTAINERS_KEY = ['containers'] as const;

export function useContainers() {
  return useQuery({ queryKey: CONTAINERS_KEY, queryFn: () => containersApi.list() });
}

export function useContainerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: CONTAINERS_KEY });
  return {
    create: useMutation({
      mutationFn: (body: CreateContainerRequest) => containersApi.create(body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (vars: { id: string; body: UpdateContainerRequest }) =>
        containersApi.update(vars.id, vars.body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => containersApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
