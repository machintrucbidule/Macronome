import type { DayDetail, PatchDayRequest } from '@macronome/shared';
import { api } from './client';

// Days resource client (spec/api/days-meals-leftover.md §Day). GET returns an existing
// day or an unsaved scaffold; POST materializes it; PATCH sets activity/comment/override.
// The web renders the server-computed DayDetail (totals, verdicts, constat) — never recomputes.
export const daysApi = {
  get: (date: string) => api.get<DayDetail>(`/days/${date}`),
  materialize: (date: string) => api.post<DayDetail>(`/days/${date}`),
  patch: (date: string, body: PatchDayRequest) => api.patch<DayDetail>(`/days/${date}`, body),
  // Clear the day (B-046): keeps pins@0 + comment + activity, resets the verdict to Auto.
  clear: (date: string) => api.post<DayDetail>(`/days/${date}/clear`),
  // Convert a summary (light) day to a detailed day (day-model §9): seeds meals to log lines.
  convertToDetailed: (date: string) => api.post<DayDetail>(`/days/${date}/detail`),
};
