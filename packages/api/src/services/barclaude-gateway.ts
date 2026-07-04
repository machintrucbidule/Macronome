import {
  ErrorCode,
  type BarclaudeGatewayConnection,
  type ChronoProductSummary,
  type GatewayPingResponse,
} from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import { mapSummary, type RawGatewayProduct } from '../domain/integrations/index.js';
import { outboundFetch, jsonBody } from './outbound-retry.js';

// BarclaudeGateway proxy (spec/logic/integrations-connections.md §6/§7/§8): local
// drive-product gateway, X-API-Key auth, error envelope {error, code}. `ping` is the
// connection proof (B-181); `search`/`product` back the Chronodrive food search (B-182).
// The api_key is never logged.

const GATEWAY_TIMEOUT_MS = 8_000;
const SEARCH_SIZE = 10; // §8.1 — the result cap is server-side

const badResponse = (): ApiError => new ApiError(502, ErrorCode.GatewayBadResponse);

/** Status mapping; §8: a product 404 maps to gateway_not_found instead of bad_response. */
function statusError(status: number, notFoundAware: boolean): ApiError {
  if (status === 401 || status === 403) return new ApiError(502, ErrorCode.GatewayUnauthorized);
  if (status === 404 && notFoundAware) return new ApiError(404, ErrorCode.GatewayNotFound);
  return badResponse();
}

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
  notFoundAware = false,
): Promise<unknown> {
  const url = `${cfg.base_url.replace(/\/+$/, '')}/api/v1/${path}`;
  const res = await outboundFetch(
    'barclaude-gateway',
    url,
    { headers: { 'X-API-Key': cfg.api_key } },
    GATEWAY_TIMEOUT_MS,
    {
      unreachable: () => new ApiError(504, ErrorCode.GatewayUnreachable),
      unavailable: () => new ApiError(503, ErrorCode.GatewayUnavailable),
      status: (status) => statusError(status, notFoundAware),
    },
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

/** §8.1 — product search; always caps upstream at size=10, shapes compact rows. */
export async function search(
  cfg: BarclaudeGatewayConnection | null,
  q: string,
): Promise<ChronoProductSummary[]> {
  configured(cfg);
  const path = `search?q=${encodeURIComponent(q)}&size=${SEARCH_SIZE}`;
  const body = (await callGateway(cfg, path)) as { products?: unknown } | null;
  const products = body?.products;
  if (!Array.isArray(products)) throw badResponse();
  return products.map((p) => mapSummary(p as RawGatewayProduct));
}

/** §8.2 — product detail (id or EAN); upstream 404 → gateway_not_found. */
export async function product(
  cfg: BarclaudeGatewayConnection | null,
  idOrEan: string,
): Promise<RawGatewayProduct> {
  configured(cfg);
  const body = await callGateway(cfg, `products/${encodeURIComponent(idOrEan)}`, true);
  if (!body || typeof body !== 'object') throw badResponse();
  return body;
}
