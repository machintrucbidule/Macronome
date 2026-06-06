import type {
  LeftoverGroup,
  LeftoverPreviewRequest,
  LeftoverPreviewResponse,
  LeftoverRequest,
  PatchLeftoverRequest,
} from '@macronome/shared';
import { api } from './client';

// Leftover (plate-deduction) client (spec/api/days-meals-leftover.md §Leftover). Create
// hangs off /meals/:mealId; re-edit/delete operate on a group by id. The server validates
// (409 gross_below_tare / leftover_exceeds_served — nothing written on block) and prorates;
// the web previews by calling the API (POST …/leftover/preview), never computing the
// proration itself (CLAUDE.md rule 2).
export const leftoverApi = {
  create: (mealId: string, body: LeftoverRequest) =>
    api.post<LeftoverGroup>(`/meals/${mealId}/leftover`, body),
  update: (groupId: string, body: PatchLeftoverRequest) =>
    api.patch<LeftoverGroup>(`/leftover/${groupId}`, body),
  remove: (groupId: string) => api.del<void>(`/leftover/${groupId}`),
  preview: (mealId: string, body: LeftoverPreviewRequest) =>
    api.post<LeftoverPreviewResponse>(`/meals/${mealId}/leftover/preview`, body),
};
