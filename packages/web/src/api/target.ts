import type {
  CreateTargetRequest,
  GetTargetResponse,
  SuggestTargetRequest,
  SuggestTargetResponse,
} from '@macronome/shared';
import { api } from './client';

// Targets & metabolic-engine client (spec/api/weight-targets-stats-settings.md
// §Targets). The web reads the engine readout and never recomputes any figure; saving
// returns the fresh readout so the derived tiles + warnings refresh from the server.

export const targetApi = {
  get: () => api.get<GetTargetResponse>('/target'),
  create: (body: CreateTargetRequest) => api.post<GetTargetResponse>('/target', body),
  suggest: (body: SuggestTargetRequest) => api.post<SuggestTargetResponse>('/target/suggest', body),
};
