import { ErrorCode, type HaWeightResponse, type HomeAssistantConnection } from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import { outboundFetch, jsonBody } from './outbound-retry.js';

// Home Assistant weight proxy (spec/logic/integrations-connections.md §5, B-180):
// GET {base_url}/api/states/{weight_entity_id} with the stored long-lived token, then
// validate the state and round it server-side (round half up) to the configured
// decimals — the web never computes. Error table in §7; the token is never logged.

const HA_TIMEOUT_MS = 10_000;

const badResponse = (): ApiError => new ApiError(502, ErrorCode.HaBadResponse);

const ERROR_MAP = {
  unreachable: () => new ApiError(504, ErrorCode.HaUnreachable),
  unavailable: () => new ApiError(503, ErrorCode.HaUnavailable),
  status: (status: number): ApiError => {
    if (status === 401 || status === 403) return new ApiError(502, ErrorCode.HaUnauthorized);
    if (status === 404) return new ApiError(502, ErrorCode.HaEntityNotFound);
    return badResponse();
  },
};

interface HaState {
  state?: unknown;
  last_changed?: unknown;
  attributes?: { unit_of_measurement?: unknown };
}

function configured(
  cfg: HomeAssistantConnection | null,
): asserts cfg is HomeAssistantConnection & { token: string } {
  if (!cfg || !cfg.base_url || !cfg.token?.trim() || !cfg.weight_entity_id) {
    throw new ApiError(409, ErrorCode.HaNotConfigured);
  }
}

/** Round half up to `decimals` (positive weights only, so Math.round suffices). */
const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** §5 — read the latest scale measurement; doubles as the HA card's connection proof. */
export async function fetchWeight(cfg: HomeAssistantConnection | null): Promise<HaWeightResponse> {
  configured(cfg);
  const url = `${cfg.base_url.replace(/\/+$/, '')}/api/states/${cfg.weight_entity_id}`;
  const res = await outboundFetch(
    'ha-weight',
    url,
    { headers: { Authorization: `Bearer ${cfg.token}` } },
    HA_TIMEOUT_MS,
    ERROR_MAP,
  );
  const body = (await jsonBody(res, badResponse)) as HaState;

  const state = typeof body.state === 'string' ? body.state : '';
  if (state === 'unavailable' || state === 'unknown') {
    throw new ApiError(409, ErrorCode.HaNoMeasurement);
  }
  const unit = body.attributes?.unit_of_measurement;
  const value = Number(state);
  if (state === '' || !Number.isFinite(value) || unit !== 'kg') throw badResponse();

  return {
    weight_kg: roundTo(value, cfg.weight_round_decimals),
    measured_at: typeof body.last_changed === 'string' ? body.last_changed : '',
    unit,
    entity_id: cfg.weight_entity_id,
  };
}
