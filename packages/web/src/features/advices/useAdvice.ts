import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../api/ai';

// Data hooks for the Conseils page (B-202). The advice archive is the source of truth: GET /ai/advice
// lists it newest-first; generate (POST) and delete both invalidate the list so it refreshes. The
// web never computes — it renders the server's Markdown + the read-service dashboard (rule 2).
export const ADVICE_KEY = 'advice';

/** The user's archived advices, newest first. */
export function useAdviceList() {
  return useQuery({ queryKey: [ADVICE_KEY], queryFn: () => aiApi.listAdvice() });
}

/** Generate (a paid model call, archives the reply) + delete one; both refresh the archive list. */
export function useAdviceMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: [ADVICE_KEY] });
  };
  const generate = useMutation({ mutationFn: () => aiApi.generateAdvice(), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: string) => aiApi.deleteAdvice(id),
    onSuccess: invalidate,
  });
  return { generate, remove };
}
