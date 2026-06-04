import type { JournalResponse } from '@macronome/shared';
import { api } from './client';

// Journal read view client (spec/api/days-meals-leftover.md §Journal). One row per logged
// day of a year. The Repas calendar popover uses it to mark which days have logs; the
// full Journal screen is M3c.
export const journalApi = {
  list: (year: number) => api.get<JournalResponse>(`/journal?year=${year}`),
};
