import type { GatewayPingResponse, HaWeightResponse } from '@macronome/shared';
import { api } from './client';

// Server-side integration proxies (spec/api/integrations.md). The stored configs are
// edited via settingsApi.patch; these endpoints read them server-side (secrets never
// reach the browser).
export const integrationsApi = {
  fetchHaWeight: () => api.get<{ data: HaWeightResponse }>('/integrations/home-assistant/weight'),
  pingGateway: () => api.get<{ data: GatewayPingResponse }>('/integrations/barclaude-gateway/ping'),
};
