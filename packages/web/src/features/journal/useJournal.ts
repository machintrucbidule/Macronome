import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchDayRequest } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { journalApi } from '../../api/journal';
import { daysApi } from '../../api/days';
import { JOURNAL_KEY, invalidateDayScope } from '../../lib/day-scope';

// Data layer for the Journal screen: the per-year read query plus the day-level PATCH
// mutation (verdict override / activity / comment). All figures are server-computed; the
// screen only renders them and emits edits. A successful patch invalidates the whole day scope —
// the journal list, that day's Repas cache and the app-frame tone (a verdict override moves the
// tone directly, B-294) — so every surface stays in sync. A rejected patch surfaces its error
// code so the page can show a banner, like Repas (B-098).

export function useJournal(year: number) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [JOURNAL_KEY, year],
    queryFn: () => journalApi.list(year),
  });

  const patch = useMutation({
    mutationFn: ({ date, body }: { date: string; body: PatchDayRequest }) =>
      daysApi.patch(date, body),
    onSuccess: (_data, vars) => {
      setError(null);
      invalidateDayScope(qc, vars.date);
    },
    onError: (e) => setError(e instanceof ApiError ? e.code : 'request_failed'),
  });

  return { query, patch, error, dismissError: () => setError(null) };
}
