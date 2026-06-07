import type { DataMutationResult } from '@macronome/shared';
import { api, downloadFile } from './client';

// Data management resource client (spec/api/data-export-import.md — IMP-1). Export downloads a
// JSON snapshot file; import REPLACES the account with an uploaded snapshot; wipe clears tracked
// data. The web reads/forwards — it never reshapes the snapshot.

export const dataApi = {
  exportFile: () => downloadFile('/data/export', 'macronome-export.json'),
  import: (envelope: unknown) => api.post<{ data: DataMutationResult }>('/data/import', envelope),
  wipe: () => api.post<{ data: DataMutationResult }>('/data/wipe'),
};
