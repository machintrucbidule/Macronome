import type { DayDetail, DayToneResponse, PatchDayRequest } from '@macronome/shared';
import { api } from './client';

// Days resource client (spec/api/days-meals-leftover.md §Day). GET returns an existing
// day or an unsaved scaffold; POST materializes it; PATCH sets activity/comment/override.
// The web renders the server-computed DayDetail (totals, verdicts, constat) — never recomputes.
export const daysApi = {
  get: (date: string) => api.get<DayDetail>(`/days/${date}`),
  // The day's compliance colour only (B-262). Strictly read-only, unlike `get` which re-persists
  // the live snapshot on a non-past date — that is why the app frame polls this one.
  tone: (date: string) => api.get<DayToneResponse>(`/days/${date}/tone`),
  materialize: (date: string) => api.post<DayDetail>(`/days/${date}`),
  patch: (date: string, body: PatchDayRequest) => api.patch<DayDetail>(`/days/${date}`, body),
  // Clear the day (B-046): keeps pins@0 + comment + activity, resets the verdict to Auto.
  clear: (date: string) => api.post<DayDetail>(`/days/${date}/clear`),
  // Copy another day into this one (CP-1 / B-082): replaces the day with a faithful copy of
  // `from` (yesterday). 409 copy_source_empty when the source has nothing to copy.
  copyFrom: (date: string, from: string) =>
    api.post<DayDetail>(`/days/${date}/copy-from`, { from }),
  // Convert a summary (light) day to a detailed day (day-model §9): seeds meals to log lines.
  convertToDetailed: (date: string) => api.post<DayDetail>(`/days/${date}/detail`),
  // Convert a detailed (Complet) day to a summary (Partiel) day (DK-1 / B-078): discards the
  // lines and sets summary_kcal := the day's current Σ (client gates Σ>0 behind a confirm).
  convertToSummary: (date: string) => api.post<DayDetail>(`/days/${date}/summary`),
  // Undo the last destructive day action (B-261): restores the day verbatim from the server's
  // restore point — lines, frozen macro snaps, leftovers and their frozen containers. Undo is
  // single-level, so a second call answers 409 nothing_to_undo.
  undo: (date: string) => api.post<DayDetail>(`/days/${date}/undo`),
};
