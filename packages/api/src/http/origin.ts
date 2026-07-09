import type { Request } from 'express';
import { env } from '../config/env.js';
import { resolveOrigin } from './origin-resolve.js';

// Public-origin derivation for the Google Drive OAuth callback (§9.2, ADR-0004). Preference:
// the explicit `PUBLIC_ORIGIN` env when set (robust behind a reverse proxy / tunnel — B-217),
// else the request headers (`req.protocol`/`req.get('host')`, which honour X-Forwarded-* only
// behind the trusted proxy, trustProxy.ts). The callback URL must be byte-identical between
// /connect and /callback, so both derive it here; the HTTPS gate checks the SAME resolved origin.
// The pure resolution lives in origin-resolve.ts (env-free) so it is unit-testable.

const CALLBACK_PATH = '/api/v1/integrations/google-drive/callback';

/** `{scheme}://{host}` for this request — PUBLIC_ORIGIN if set, else the (trusted) headers. */
export function deriveOrigin(req: Request): string {
  return resolveOrigin(env.PUBLIC_ORIGIN, req);
}

/** The exact OAuth redirect URI the operator must register in their Google client. */
export function callbackUrl(req: Request): string {
  return `${deriveOrigin(req)}${CALLBACK_PATH}`;
}

/** The hardened posture (§9.1/§9.5): Connect needs the resolved origin to be HTTPS. */
export function isHttpsOrigin(req: Request): boolean {
  return deriveOrigin(req).startsWith('https://');
}
