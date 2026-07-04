import type { IntegrationsRead } from '@macronome/shared';
import type { StoredIntegrations } from './merge.js';

// Redaction (spec/logic/integrations-connections.md §4). Strips the secrets before the
// config leaves the API: `token` → `token_set`, `api_key` → `api_key_set` (true iff a
// non-empty secret is stored); everything else passes through. Null connection → null.

const isSet = (secret: string | undefined): boolean =>
  typeof secret === 'string' && secret.trim().length > 0;

export function redactIntegrations(integrations: StoredIntegrations): IntegrationsRead {
  const ha = integrations.home_assistant;
  const bg = integrations.barclaude_gateway;
  return {
    home_assistant: ha
      ? {
          base_url: ha.base_url,
          token_set: isSet(ha.token),
          weight_entity_id: ha.weight_entity_id,
          weight_round_decimals: ha.weight_round_decimals,
        }
      : null,
    barclaude_gateway: bg ? { base_url: bg.base_url, api_key_set: isSet(bg.api_key) } : null,
  };
}
