import type { GoogleDriveConnection } from '@macronome/shared';
import { outboundFetch, jsonBody } from '../outbound-retry.js';
import { TOKEN_URL, GDRIVE_TIMEOUT_MS } from './constants.js';
import { assertConnected, gdriveBadResponse, TOKEN_ERROR_MAP } from './errors.js';

// Exchange the stored refresh token for a short-lived access token (§9.2). The access
// token is never persisted — it is obtained on demand and used in-memory for the Drive
// calls of a single backup run.

/** Refresh-token grant → a fresh access token. Throws gdrive_token_expired on a rejected grant. */
export async function refreshAccessToken(cfg: GoogleDriveConnection | null): Promise<string> {
  assertConnected(cfg);
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    refresh_token: cfg.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await outboundFetch(
    'gdrive-token',
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    },
    GDRIVE_TIMEOUT_MS,
    TOKEN_ERROR_MAP,
  );
  const body = (await jsonBody(res, gdriveBadResponse)) as { access_token?: unknown };
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw gdriveBadResponse();
  }
  return body.access_token;
}
