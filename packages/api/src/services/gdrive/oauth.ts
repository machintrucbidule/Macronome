import { ErrorCode, type GoogleDriveConnection } from '@macronome/shared';
import { ApiError } from '../../http/errors.js';
import { outboundFetch, jsonBody } from '../outbound-retry.js';
import { AUTH_URL, TOKEN_URL, REVOKE_URL, SCOPE, GDRIVE_TIMEOUT_MS } from './constants.js';
import { assertConfigured, EXCHANGE_ERROR_MAP } from './errors.js';

// OAuth handshake (spec/logic/integrations-connections.md §9.2): build the consent URL,
// exchange the returned code for a refresh token, and best-effort revoke on disconnect.
// `access_type=offline` + `prompt=consent` guarantee a refresh token every time.

const oauthFailed = (): ApiError => new ApiError(502, ErrorCode.GdriveOauthFailed);

/** The Google authorization URL for the given callback and anti-forgery `state`. */
export function buildAuthUrl(
  cfg: GoogleDriveConnection | null,
  redirectUri: string,
  state: string,
): string {
  assertConfigured(cfg);
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchange the authorization `code` for a refresh token (§9.2). */
export async function exchangeCode(
  cfg: GoogleDriveConnection | null,
  code: string,
  redirectUri: string,
): Promise<string> {
  assertConfigured(cfg);
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await outboundFetch(
    'gdrive-exchange',
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    },
    GDRIVE_TIMEOUT_MS,
    EXCHANGE_ERROR_MAP,
  );
  const body = (await jsonBody(res, oauthFailed)) as { refresh_token?: unknown };
  if (typeof body.refresh_token !== 'string' || body.refresh_token.length === 0)
    throw oauthFailed();
  return body.refresh_token;
}

/** Best-effort token revocation on disconnect (§9.3) — never throws. */
export async function revoke(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(GDRIVE_TIMEOUT_MS),
    });
  } catch {
    // The local token is cleared regardless; a failed upstream revoke is not surfaced.
  }
}
