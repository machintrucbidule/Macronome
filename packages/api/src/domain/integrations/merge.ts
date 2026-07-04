import type {
  BarclaudeGatewayConnection,
  BarclaudeGatewayPatch,
  HomeAssistantConnection,
  HomeAssistantPatch,
  IntegrationsPatch,
} from '@macronome/shared';

// Per-connection merge of a partial `integrations` patch onto the stored value
// (spec/logic/integrations-connections.md §3): a connection key absent → untouched,
// null → disconnected, object → field merge with the ai.api_key secret rule
// (absent = keep, ''/null = clear, else replace). Same doctrine as ai-connection/merge.ts.

/** Stored (raw, secret-bearing) shape of settings.integrations. Type alias (not an
 * interface) so it stays assignable to Prisma's InputJsonValue. */
export type StoredIntegrations = {
  home_assistant: HomeAssistantConnection | null;
  barclaude_gateway: BarclaudeGatewayConnection | null;
};

export const INTEGRATIONS_DEFAULTS: StoredIntegrations = {
  home_assistant: null,
  barclaude_gateway: null,
};

/** Secret: absent ⇒ keep; '' or null ⇒ clear (undefined); else replace. */
function resolveSecret(
  stored: string | undefined,
  patched: string | null | undefined,
): string | undefined {
  if (patched === undefined) return stored;
  return patched === null || patched.trim() === '' ? undefined : patched;
}

function mergeHa(
  stored: HomeAssistantConnection | null,
  patch: HomeAssistantPatch,
): HomeAssistantConnection {
  const result: HomeAssistantConnection = {
    base_url: patch.base_url ?? stored?.base_url ?? '',
    weight_entity_id: patch.weight_entity_id ?? stored?.weight_entity_id ?? '',
    weight_round_decimals: patch.weight_round_decimals ?? stored?.weight_round_decimals ?? 1,
  };
  const token = resolveSecret(stored?.token, patch.token);
  if (token !== undefined) result.token = token;
  return result;
}

function mergeGateway(
  stored: BarclaudeGatewayConnection | null,
  patch: BarclaudeGatewayPatch,
): BarclaudeGatewayConnection {
  const result: BarclaudeGatewayConnection = { base_url: patch.base_url ?? stored?.base_url ?? '' };
  const api_key = resolveSecret(stored?.api_key, patch.api_key);
  if (api_key !== undefined) result.api_key = api_key;
  return result;
}

export function mergeIntegrations(
  stored: StoredIntegrations,
  patch: IntegrationsPatch,
): StoredIntegrations {
  return {
    home_assistant:
      patch.home_assistant === undefined
        ? stored.home_assistant
        : patch.home_assistant === null
          ? null
          : mergeHa(stored.home_assistant, patch.home_assistant),
    barclaude_gateway:
      patch.barclaude_gateway === undefined
        ? stored.barclaude_gateway
        : patch.barclaude_gateway === null
          ? null
          : mergeGateway(stored.barclaude_gateway, patch.barclaude_gateway),
  };
}
