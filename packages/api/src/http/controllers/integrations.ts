import type { Request, Response } from 'express';
import * as settingsService from '../../services/settings.js';
import * as haClient from '../../services/ha-client.js';
import * as gateway from '../../services/barclaude-gateway.js';

// THIN controllers (api-CLAUDE.md) for the integration proxies (spec/api/integrations.md):
// read the stored (secret-bearing) connection config and call the remote host server-side.
// Secrets never reach the client; the configs are edited via PATCH /settings.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** GET /integrations/home-assistant/weight — latest scale measurement, rounded (B-180). */
export async function haWeight(_req: Request, res: Response): Promise<void> {
  const { home_assistant } = await settingsService.rawIntegrations(userId(res));
  const weight = await haClient.fetchWeight(home_assistant);
  res.status(200).json({ data: weight });
}

/** GET /integrations/barclaude-gateway/ping — the gateway card's connection proof. */
export async function gatewayPing(_req: Request, res: Response): Promise<void> {
  const { barclaude_gateway } = await settingsService.rawIntegrations(userId(res));
  const pong = await gateway.ping(barclaude_gateway);
  res.status(200).json({ data: pong });
}
