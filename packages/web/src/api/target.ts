import type {
  CreateTargetRequest,
  GetTargetHistoryResponse,
  GetTargetResponse,
  PatchTargetRequest,
  PreviewTargetRequest,
  PreviewTargetResponse,
  RecomputeCountResponse,
  RecomputeTargetRequest,
  RecomputeTargetResponse,
  SuggestTargetRequest,
  SuggestTargetResponse,
  TargetVersion,
} from '@macronome/shared';
import { api } from './client';

// Targets & metabolic-engine client (spec/api/weight-targets-stats-settings.md
// §Targets). The web reads the engine readout and never recomputes any figure; saving
// returns the fresh readout so the derived tiles + warnings refresh from the server.
// The /targets verbs (TH-1) manage the versioned history (list/edit/delete/recompute).

export const targetApi = {
  get: () => api.get<GetTargetResponse>('/target'),
  create: (body: CreateTargetRequest) => api.post<GetTargetResponse>('/target', body),
  preview: (body: PreviewTargetRequest) => api.post<PreviewTargetResponse>('/target/preview', body),
  suggest: (body: SuggestTargetRequest) => api.post<SuggestTargetResponse>('/target/suggest', body),
  list: () => api.get<GetTargetHistoryResponse>('/targets'),
  patch: (id: string, body: PatchTargetRequest) => api.patch<TargetVersion>(`/targets/${id}`, body),
  remove: (id: string) => api.del<void>(`/targets/${id}`),
  recompute: (id: string, body: RecomputeTargetRequest = {}) =>
    api.post<RecomputeTargetResponse>(`/targets/${id}/recompute`, body),
  recomputeCount: (id: string) => api.get<RecomputeCountResponse>(`/targets/${id}/recompute-count`),
};
