import type { AdherenceResponse, RollingResponse } from '@macronome/shared';
import { api } from './client';

// Stats read client (spec/api/weight-targets-stats-settings.md §Stats). Both views are
// fully server-derived (rolling windows, heatmap, pivots, key figures, signals); the web
// only renders them (CLAUDE.md rule 2).
export const statsApi = {
  rolling: () => api.get<RollingResponse>('/stats/rolling'),
  adherence: (year: number) => api.get<AdherenceResponse>(`/stats/adherence?year=${year}`),
};
