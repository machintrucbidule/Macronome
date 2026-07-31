import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';
import * as connection from '../../services/gdrive-connection.js';
import { runBackup } from '../../services/gdrive-backup.js';
import { ApiError } from '../errors.js';
import { callbackUrl, isHttpsOrigin } from '../origin.js';

// THIN controllers for the Google Drive backup OAuth + actions (spec/api/integrations.md).
// The config (client creds, scheduling) is edited via PATCH /settings; these only run the
// handshake and the backup. Secrets never reach the client.

function userId(res: Response): string {
  return res.locals.userId as string;
}

const STATE_TTL_MS = 10 * 60 * 1000;

/** POST /connect — start OAuth: HTTPS-gated, stash anti-forgery state, return the auth URL. */
export async function connect(req: Request, res: Response): Promise<void> {
  if (!isHttpsOrigin(req)) {
    // Diagnostic for the common "behind a reverse proxy / tunnel" misconfig (B-217). No secrets.
    logger.warn(
      {
        protocol: req.protocol,
        secure: req.secure,
        host: req.get('host'),
        publicOriginSet: Boolean(env.PUBLIC_ORIGIN),
      },
      'gdrive connect refused: non-https origin (set PUBLIC_ORIGIN or TRUSTED_PROXY)',
    );
    throw new ApiError(409, ErrorCode.GdriveInsecureContext);
  }
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = { value: state, expiresAt: Date.now() + STATE_TTL_MS };
  const auth_url = await connection.connectUrl(userId(res), callbackUrl(req), state);
  res.status(200).json({ data: { auth_url } });
}

/** Consume the stored one-time state (always clears it), validating it against the query. */
function takeValidState(req: Request): boolean {
  const saved = req.session.oauthState;
  const state = req.query.state;
  delete req.session.oauthState;
  if (!saved || typeof state !== 'string') return false;
  return saved.value === state && saved.expiresAt >= Date.now();
}

/** GET /callback — Google's redirect target; 302 back to /settings with a result marker. */
export async function callback(req: Request, res: Response): Promise<void> {
  const denied = req.query.error === 'access_denied';
  const stateOk = takeValidState(req);
  const code = req.query.code;
  if (denied || !stateOk || typeof code !== 'string' || code.length === 0) {
    const reason = denied ? ErrorCode.GdriveOauthDenied : ErrorCode.GdriveOauthFailed;
    res.redirect(302, `/settings?gdrive_error=${reason}`);
    return;
  }
  try {
    await connection.completeConnect(userId(res), code, callbackUrl(req));
    res.redirect(302, '/settings?gdrive=connected');
  } catch (err) {
    const reason = err instanceof ApiError ? err.code : ErrorCode.GdriveOauthFailed;
    res.redirect(302, `/settings?gdrive_error=${reason}`);
  }
}

/** GET /status — the backup state for the Settings card. */
export async function status(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await connection.status(userId(res)) });
}

/** POST /disconnect — revoke + clear token/folder/status, keep client creds. */
export async function disconnect(_req: Request, res: Response): Promise<void> {
  await connection.disconnect(userId(res));
  res.status(200).json({ data: { connected: false } });
}

/** POST /backup-now — run one backup immediately (409 gdrive_not_connected otherwise). */
export async function backupNow(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await runBackup(userId(res)) });
}
