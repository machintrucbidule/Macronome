import { z } from 'zod';

// External-integration connection DTOs (spec/logic/integrations-connections.md,
// spec/api/integrations.md, B-180/B-181). Stored on app_user.settings.integrations;
// same triple as `ai`: full (stored) / read (redacted) / patch (partial, secret
// keep-clear-replace). Secrets (`token`, `api_key`) are write-only across the API.

const absoluteUrl = z.string().url({ message: 'invalid_url' });
const secret = z.string().refine((v) => v.trim().length > 0, { message: 'empty' });
/** HA `domain.object_id` entity format (§2); always user-supplied, never defaulted. */
const entityId = z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/, { message: 'invalid_entity_id' });
const roundDecimals = z
  .number()
  .int({ message: 'invalid_round_decimals' })
  .min(0, { message: 'invalid_round_decimals' })
  .max(3, { message: 'invalid_round_decimals' });
/** Google Drive backup retention window, in rolling days (§9). */
const retentionDays = z
  .number()
  .int({ message: 'invalid_retention_days' })
  .min(1, { message: 'invalid_retention_days' })
  .max(90, { message: 'invalid_retention_days' });
/** Daily scheduled time `HH:MM` (24-h); interpreted in `time_zone` below (§2/§9, B-220). */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'invalid_time_of_day' });
/**
 * IANA timezone the daily `time_of_day` is read in (B-220), e.g. `Europe/Paris`. Captured from
 * the user's browser when they save the schedule; when absent the scheduler falls back to the
 * server process timezone. Validated by asking the runtime's `Intl` whether it accepts the zone.
 */
const timeZone = z.string().refine(
  (v) => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: v });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'invalid_time_zone' },
);

// --- Home Assistant ---------------------------------------------------------

/** Full (stored) HA connection; `token`, when present, is non-empty after trim (§2). */
export const HomeAssistantConnectionSchema = z.object({
  base_url: absoluteUrl,
  token: secret.optional(),
  weight_entity_id: entityId,
  weight_round_decimals: roundDecimals,
});
export type HomeAssistantConnection = z.infer<typeof HomeAssistantConnectionSchema>;

/** Redacted read shape — `token` never returned; `token_set` exposes its presence (§4). */
export const HomeAssistantReadSchema = z.object({
  base_url: z.string(),
  token_set: z.boolean(),
  weight_entity_id: z.string(),
  weight_round_decimals: z.number(),
});
export type HomeAssistantRead = z.infer<typeof HomeAssistantReadSchema>;

/** Partial PATCH — `token` absent = keep, ''/null = clear, else replace (§3). */
export const HomeAssistantPatchSchema = z.object({
  base_url: absoluteUrl.optional(),
  token: z.string().nullable().optional(),
  weight_entity_id: entityId.optional(),
  weight_round_decimals: roundDecimals.optional(),
});
export type HomeAssistantPatch = z.infer<typeof HomeAssistantPatchSchema>;

// --- BarclaudeGateway -------------------------------------------------------

/** Full (stored) gateway connection; `api_key` non-empty after trim when present (§2). */
export const BarclaudeGatewayConnectionSchema = z.object({
  base_url: absoluteUrl,
  api_key: secret.optional(),
});
export type BarclaudeGatewayConnection = z.infer<typeof BarclaudeGatewayConnectionSchema>;

/** Redacted read shape (§4). */
export const BarclaudeGatewayReadSchema = z.object({
  base_url: z.string(),
  api_key_set: z.boolean(),
});
export type BarclaudeGatewayRead = z.infer<typeof BarclaudeGatewayReadSchema>;

/** Partial PATCH — `api_key` absent = keep, ''/null = clear, else replace (§3). */
export const BarclaudeGatewayPatchSchema = z.object({
  base_url: absoluteUrl.optional(),
  api_key: z.string().nullable().optional(),
});
export type BarclaudeGatewayPatch = z.infer<typeof BarclaudeGatewayPatchSchema>;

// --- Google Drive backup (B-208) --------------------------------------------

const backupStatus = z.enum(['ok', 'error']);

/**
 * Full (stored) Google Drive connection (§9). Secrets `client_secret`/`refresh_token`
 * are non-empty-when-present; `refresh_token`, `folder_id` and `last_*` are written by
 * the server (OAuth callback / scheduler / backup-now), never by a PATCH.
 */
export const GoogleDriveConnectionSchema = z.object({
  client_id: z.string(),
  client_secret: secret.optional(),
  refresh_token: secret.optional(),
  folder_id: z.string().nullable().optional(),
  enabled: z.boolean(),
  retention_days: retentionDays,
  time_of_day: timeOfDay,
  time_zone: timeZone.optional(),
  last_backup_at: z.string().nullable().optional(),
  last_status: backupStatus.nullable().optional(),
  last_error: z.string().nullable().optional(),
});
export type GoogleDriveConnection = z.infer<typeof GoogleDriveConnectionSchema>;

/** Redacted read shape — secrets → `*_set`; `refresh_token_set` is the "connected" signal (§4). */
export const GoogleDriveReadSchema = z.object({
  client_id: z.string(),
  client_secret_set: z.boolean(),
  refresh_token_set: z.boolean(),
  folder_id: z.string().nullable(),
  enabled: z.boolean(),
  retention_days: z.number(),
  time_of_day: z.string(),
  time_zone: z.string().nullable(),
  last_backup_at: z.string().nullable(),
  last_status: backupStatus.nullable(),
  last_error: z.string().nullable(),
});
export type GoogleDriveRead = z.infer<typeof GoogleDriveReadSchema>;

/**
 * Partial PATCH — only these fields are patchable; `client_secret` follows the secret
 * keep/clear/replace rule (§3). `refresh_token`/`folder_id`/`last_*` are server-written
 * and silently ignored if present (the schema is non-strict, so extra keys are stripped).
 */
export const GoogleDrivePatchSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  retention_days: retentionDays.optional(),
  time_of_day: timeOfDay.optional(),
  time_zone: timeZone.optional(),
});
export type GoogleDrivePatch = z.infer<typeof GoogleDrivePatchSchema>;

// --- Aggregate --------------------------------------------------------------

/** GET /settings read shape — all keys always present, null when not configured. */
export interface IntegrationsRead {
  home_assistant: HomeAssistantRead | null;
  barclaude_gateway: BarclaudeGatewayRead | null;
  google_drive: GoogleDriveRead | null;
}

/**
 * PATCH /settings `integrations` — per-connection: absent = untouched, null =
 * disconnect, object = field merge (§3). The key itself is optional on
 * PatchSettingsSchema, not nullable.
 */
export const IntegrationsPatchSchema = z.object({
  home_assistant: HomeAssistantPatchSchema.nullable().optional(),
  barclaude_gateway: BarclaudeGatewayPatchSchema.nullable().optional(),
  google_drive: GoogleDrivePatchSchema.nullable().optional(),
});
export type IntegrationsPatch = z.infer<typeof IntegrationsPatchSchema>;

// --- Proxy responses (spec/api/integrations.md) ------------------------------

/** GET /integrations/home-assistant/weight — weight rounded server-side (§5). */
export interface HaWeightResponse {
  weight_kg: number;
  measured_at: string;
  unit: string;
  entity_id: string;
}

/** GET /integrations/barclaude-gateway/ping (§6). */
export interface GatewayPingResponse {
  status: string;
  version: number;
}

/** POST /integrations/google-drive/connect — the Google consent URL to visit (§9.2). */
export interface GdriveConnectResponse {
  auth_url: string;
}

/** GET /integrations/google-drive/status — backup state for the Settings card (§9). */
export interface GdriveStatusResponse {
  connected: boolean;
  enabled: boolean;
  retention_days: number;
  time_of_day: string;
  last_backup_at: string | null;
  last_status: 'ok' | 'error' | null;
  last_error: string | null;
  folder_url: string | null;
}

/** POST /integrations/google-drive/backup-now & /disconnect result (§9). */
export interface GdriveBackupResult {
  last_backup_at: string | null;
  last_status: 'ok' | 'error' | null;
  last_error: string | null;
}
