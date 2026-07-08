import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';

// Utilisateurs data hooks (spec/api/users-admin.md, B-192). List + role/delete
// mutations; every mutation invalidates the list. Guards are server-side.
export const USERS_KEY = ['users'] as const;

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: () => usersApi.list() });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: USERS_KEY });
  return {
    setRole: useMutation({
      mutationFn: (vars: { id: string; is_admin: boolean }) =>
        usersApi.setRole(vars.id, { is_admin: vars.is_admin }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => usersApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
