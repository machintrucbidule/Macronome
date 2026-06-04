import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchDayRequest } from '@macronome/shared';
import { journalApi } from '../../api/journal';
import { daysApi } from '../../api/days';

// Data layer for the Journal screen: the per-year read query plus the day-level PATCH
// mutation (verdict override / activity / comment). All figures are server-computed; the
// screen only renders them and emits edits. A successful patch invalidates both the
// journal list and that day's Repas cache so the two screens stay in sync.
const JOURNAL_KEY = 'journal';

export function useJournal(year: number) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [JOURNAL_KEY, year],
    queryFn: () => journalApi.list(year),
  });

  const patch = useMutation({
    mutationFn: ({ date, body }: { date: string; body: PatchDayRequest }) =>
      daysApi.patch(date, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [JOURNAL_KEY] });
      void qc.invalidateQueries({ queryKey: ['day', vars.date] });
    },
  });

  return { query, patch };
}
