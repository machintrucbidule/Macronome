import type {
  ChronoProductResponse,
  ChronoProductSummary,
  GatewayPingResponse,
  GdriveBackupResult,
  GdriveConnectResponse,
  HaWeightResponse,
} from '@macronome/shared';
import { api } from './client';

// Server-side integration proxies (spec/api/integrations.md). The stored configs are
// edited via settingsApi.patch; these endpoints read them server-side (secrets never
// reach the browser).
export const integrationsApi = {
  fetchHaWeight: () => api.get<{ data: HaWeightResponse }>('/integrations/home-assistant/weight'),
  pingGateway: () => api.get<{ data: GatewayPingResponse }>('/integrations/barclaude-gateway/ping'),
  searchProducts: (q: string) =>
    api.get<{ data: ChronoProductSummary[] }>(
      `/integrations/barclaude-gateway/search?q=${encodeURIComponent(q)}`,
    ),
  getProduct: (id: string) =>
    api.get<{ data: ChronoProductResponse }>(
      `/integrations/barclaude-gateway/products/${encodeURIComponent(id)}`,
    ),
};

// Google Drive backup actions (B-208, spec/api/integrations.md §Google Drive backup). The
// config (client creds, enable, retention, time) is edited via settingsApi.patch; these run
// the OAuth handshake / a manual backup. Display state is read from settings.integrations
// .google_drive (redacted). `connect` returns the Google consent URL to navigate to.
export const googleDriveApi = {
  connect: () => api.post<{ data: GdriveConnectResponse }>('/integrations/google-drive/connect'),
  disconnect: () =>
    api.post<{ data: { connected: boolean } }>('/integrations/google-drive/disconnect'),
  backupNow: () => api.post<{ data: GdriveBackupResult }>('/integrations/google-drive/backup-now'),
};
