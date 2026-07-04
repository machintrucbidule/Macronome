import {
  ErrorCode,
  type BarclaudeGatewayConnection,
  type GatewayPingResponse,
} from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import { outboundFetch, jsonBody } from './outbound-retry.js';

// BarclaudeGateway proxy (spec/logic/integrations-connections.md §6/§7): local drive-product
// gateway, X-API-Key auth, error envelope {error, code}. `ping` is the connection proof
// (B-181); the search/product proxies (B-182) build on the same call helper. The api_key
// is never logged.

const GATEWAY_TIMEOUT_MS = 8_000;

const badResponse = (): ApiError => new ApiError(502, ErrorCode.GatewayBadResponse);

const ERROR_MAP = {
  unreachable: () => new ApiError(504, ErrorCode.GatewayUnreachable),
  unavailable: () => new ApiError(503, ErrorCode.GatewayUnavailable),
  status: (status: number): ApiError => {
    if (status === 401 || status === 403) return new ApiError(502, ErrorCode.GatewayUnauthorized);
    return badResponse();
  },
};

function configured(
  cfg: BarclaudeGatewayConnection | null,
): asserts cfg is BarclaudeGatewayConnection & { api_key: string } {
  if (!cfg || !cfg.base_url || !cfg.api_key?.trim()) {
    throw new ApiError(409, ErrorCode.GatewayNotConfigured);
  }
}

/** GET {base}/api/v1/{path} with the stored key; returns the parsed JSON body. */
async function callGateway(
  cfg: BarclaudeGatewayConnection & { api_key: string },
  path: string,
): Promise<unknown> {
  const url = `${cfg.base_url.replace(/\/+$/, '')}/api/v1/${path}`;
  const res = await outboundFetch(
    'barclaude-gateway',
    url,
    { headers: { 'X-API-Key': cfg.api_key } },
    GATEWAY_TIMEOUT_MS,
    ERROR_MAP,
  );
  return jsonBody(res, badResponse);
}

/** §6 — ping; the gateway card's connection proof. */
export async function ping(cfg: BarclaudeGatewayConnection | null): Promise<GatewayPingResponse> {
  configured(cfg);
  const body = (await callGateway(cfg, 'ping')) as Partial<GatewayPingResponse> | null;
  if (!body || body.status !== 'ok' || typeof body.version !== 'number') throw badResponse();
  return { status: body.status, version: body.version };
}
