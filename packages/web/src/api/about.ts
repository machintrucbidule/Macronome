import type { AboutInfo } from '@macronome/shared';
import { api } from './client';

// About read client (spec/api/system-info.md). The server gathers the app + server/runtime
// snapshot; the web only renders it (CLAUDE.md rule 2). Authenticated.
export const aboutApi = {
  get: () => api.get<{ data: AboutInfo }>('/about'),
};
