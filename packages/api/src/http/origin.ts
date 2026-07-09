import type { Request } from 'express';
import { ErrorCode } from '@macronome/shared';
import { ApiError } from './errors.js';

// Request-origin derivation for the Google Drive OAuth callback (§9.2, ADR-0004). Because
// `trust proxy` is set to TRUSTED_PROXY (trustProxy.ts), req.protocol/req.secure/req.get
// ('host') honour X-Forwarded-Proto/Host only behind the trusted proxy. The callback URL
// must be byte-identical between /connect and /callback, so both derive it here.

const CALLBACK_PATH = '/api/v1/integrations/google-drive/callback';

/** `{scheme}://{host}` derived from the (trusted) request headers. */
export function deriveOrigin(req: Request): string {
  return `${req.protocol}://${req.get('host') ?? ''}`;
}

/** The exact OAuth redirect URI the operator must register in their Google client. */
export function callbackUrl(req: Request): string {
  return `${deriveOrigin(req)}${CALLBACK_PATH}`;
}

/** Enforce the hardened posture — Connect needs an HTTPS origin (§9.1/§9.5). */
export function assertHttpsOrigin(req: Request): void {
  if (!req.secure) throw new ApiError(409, ErrorCode.GdriveInsecureContext);
}
