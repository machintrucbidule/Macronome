import { ErrorCode, type GoogleDriveConnection } from '@macronome/shared';
import { ApiError } from '../../http/errors.js';
import type { OutboundErrorMap } from '../outbound-retry.js';

// Google Drive error mapping + config guards (spec/logic/integrations-connections.md §9.5).
// Three distinct outbound maps: Drive REST calls, the refresh-token grant, and the
// authorization-code exchange each translate upstream failures to the §9.5 codes.

export const gdriveBadResponse = (): ApiError => new ApiError(502, ErrorCode.GdriveBadResponse);

/** Drive REST calls (folder / upload / list / delete), Bearer access token. */
export const DRIVE_ERROR_MAP: OutboundErrorMap = {
  unreachable: () => new ApiError(504, ErrorCode.GdriveUnreachable),
  unavailable: () => new ApiError(503, ErrorCode.GdriveUnavailable),
  status: (status, raw) => {
    if (status === 401) return new ApiError(502, ErrorCode.GdriveUnauthorized);
    if (status === 403) {
      return /quota|storagequota/i.test(raw)
        ? new ApiError(502, ErrorCode.GdriveQuotaExceeded)
        : new ApiError(502, ErrorCode.GdriveUnauthorized);
    }
    return gdriveBadResponse();
  },
};

/** Refresh-token grant: a rejected grant means the token is revoked/expired → reconnect. */
export const TOKEN_ERROR_MAP: OutboundErrorMap = {
  unreachable: () => new ApiError(504, ErrorCode.GdriveUnreachable),
  unavailable: () => new ApiError(503, ErrorCode.GdriveUnavailable),
  status: (status) =>
    status === 400 || status === 401
      ? new ApiError(502, ErrorCode.GdriveTokenExpired)
      : gdriveBadResponse(),
};

/** Authorization-code exchange (Connect callback): any failure → oauth failed. */
export const EXCHANGE_ERROR_MAP: OutboundErrorMap = {
  unreachable: () => new ApiError(504, ErrorCode.GdriveUnreachable),
  unavailable: () => new ApiError(503, ErrorCode.GdriveUnavailable),
  status: () => new ApiError(502, ErrorCode.GdriveOauthFailed),
};

/** Connect requires the operator's OAuth client (client_id + client_secret) stored. */
export function assertConfigured(
  cfg: GoogleDriveConnection | null,
): asserts cfg is GoogleDriveConnection & { client_secret: string } {
  if (!cfg || !cfg.client_id?.trim() || !cfg.client_secret?.trim()) {
    throw new ApiError(409, ErrorCode.GdriveNotConfigured);
  }
}

/** Backup / refresh requires a stored refresh token (and the client to refresh it with). */
export function assertConnected(
  cfg: GoogleDriveConnection | null,
): asserts cfg is GoogleDriveConnection & { client_secret: string; refresh_token: string } {
  if (!cfg || !cfg.client_id?.trim() || !cfg.client_secret?.trim() || !cfg.refresh_token?.trim()) {
    throw new ApiError(409, ErrorCode.GdriveNotConnected);
  }
}
