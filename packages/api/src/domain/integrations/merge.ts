import type {
  BarclaudeGatewayConnection,
  BarclaudeGatewayPatch,
  GoogleDriveConnection,
  GoogleDrivePatch,
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
  google_drive: GoogleDriveConnection | null;
};

export const INTEGRATIONS_DEFAULTS: StoredIntegrations = {
  home_assistant: null,
  barclaude_gateway: null,
  google_drive: null,
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

/** The server-written fields, carried verbatim from the stored connection (never patched). */
function serverFields(stored: GoogleDriveConnection | null): Partial<GoogleDriveConnection> {
  if (!stored) return {};
  const { refresh_token, folder_id, last_backup_at, last_status, last_error } = stored;
  return { refresh_token, folder_id, last_backup_at, last_status, last_error };
}

/** Google Drive (§9): the `client_secret` follows the secret rule; the server-written
 * fields (`refresh_token`, `folder_id`, `last_*`) are carried over from the stored
 * connection and NEVER read from a patch (set only by the OAuth callback / scheduler). */
const GDRIVE_DEFAULTS = {
  client_id: '',
  enabled: false,
  retention_days: 7,
  time_of_day: '03:00',
  time_zone: undefined as string | undefined,
};

function mergeGdrive(
  stored: GoogleDriveConnection | null,
  patch: GoogleDrivePatch,
): GoogleDriveConnection {
  const prev = stored ?? GDRIVE_DEFAULTS;
  const result: GoogleDriveConnection = {
    ...serverFields(stored),
    client_id: patch.client_id ?? prev.client_id,
    enabled: patch.enabled ?? prev.enabled,
    retention_days: patch.retention_days ?? prev.retention_days,
    time_of_day: patch.time_of_day ?? prev.time_of_day,
    time_zone: patch.time_zone ?? prev.time_zone,
  };
  const client_secret = resolveSecret(stored?.client_secret, patch.client_secret);
  if (client_secret !== undefined) result.client_secret = client_secret;
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
    google_drive:
      patch.google_drive === undefined
        ? stored.google_drive
        : patch.google_drive === null
          ? null
          : mergeGdrive(stored.google_drive, patch.google_drive),
  };
}
