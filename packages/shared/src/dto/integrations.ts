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

// --- Aggregate --------------------------------------------------------------

/** GET /settings read shape — both keys always present, null when not configured. */
export interface IntegrationsRead {
  home_assistant: HomeAssistantRead | null;
  barclaude_gateway: BarclaudeGatewayRead | null;
}

/**
 * PATCH /settings `integrations` — per-connection: absent = untouched, null =
 * disconnect, object = field merge (§3). The key itself is optional on
 * PatchSettingsSchema, not nullable.
 */
export const IntegrationsPatchSchema = z.object({
  home_assistant: HomeAssistantPatchSchema.nullable().optional(),
  barclaude_gateway: BarclaudeGatewayPatchSchema.nullable().optional(),
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
