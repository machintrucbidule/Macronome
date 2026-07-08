import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';

// Pending token links (B-193/B-194): list + create/revoke mutations. The raw
// token only exists in a creation response — the list never carries it.
export const TOKENS_KEY = ['users', 'tokens'] as const;

export function useTokens() {
  return useQuery({ queryKey: TOKENS_KEY, queryFn: () => usersApi.listTokens() });
}

export function useTokenMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: TOKENS_KEY });
  return {
    createInvite: useMutation({
      mutationFn: (isAdmin: boolean) => usersApi.createInvite(isAdmin),
      onSuccess: invalidate,
    }),
    createResetToken: useMutation({
      mutationFn: (userId: string) => usersApi.createResetToken(userId),
      onSuccess: invalidate,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => usersApi.revokeToken(id),
      onSuccess: invalidate,
    }),
  };
}

/** Shareable URL for a raw token — the secret rides the fragment (never logged). */
export function tokenUrl(kind: 'invite' | 'password_reset', rawToken: string): string {
  const path = kind === 'invite' ? '/invite' : '/reset';
  return `${window.location.origin}${path}#${rawToken}`;
}
