import type {
  CreateWeighInRequest,
  GetWeightResponse,
  IntervalDaysResponse,
  PatchWeighInRequest,
  WeightRange,
} from '@macronome/shared';
import { api } from './client';

// Weight client (spec/api/weight-targets-stats-settings.md §Weight). The web reads the
// server-derived EMA/trajectory/periods/cartouche and never recomputes a figure; every
// write returns the fresh view so the chart + table + cartouche refresh from the server.
export const weightApi = {
  get: (range: WeightRange = 'all') => api.get<GetWeightResponse>(`/weight?range=${range}`),
  create: (body: CreateWeighInRequest) => api.post<GetWeightResponse>('/weight', body),
  patch: (id: string, body: PatchWeighInRequest) =>
    api.patch<GetWeightResponse>(`/weight/${id}`, body),
  del: (id: string) => api.del<void>(`/weight/${id}`),
  // Read-only per-day recap of a period's interval [start,end] inclusive (B-225).
  intervalDays: (start: string, end: string) =>
    api.get<IntervalDaysResponse>(`/weight/interval-days?start=${start}&end=${end}`),
};
