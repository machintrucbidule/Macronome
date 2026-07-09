import type { GdriveStatusResponse, GoogleDriveConnection } from '@macronome/shared';
import * as gdrive from './gdrive/index.js';
import { rawGoogleDrive, writeGoogleDrive } from './settings.js';

const NOT_CONFIGURED: GoogleDriveConnection = {
  client_id: '',
  enabled: false,
  retention_days: 7,
  time_of_day: '03:00',
};

// OAuth connect / callback / disconnect / status orchestration (§9.2–§9.3). The connection
// config (client_id/secret, scheduling) is edited via PATCH /settings; these functions only
// perform the handshake and write the server-managed fields (refresh_token, folder_id).

/** Build the Google consent URL for the given callback + anti-forgery state (§9.2). */
export async function connectUrl(
  userId: string,
  redirectUri: string,
  state: string,
): Promise<string> {
  const cfg = await rawGoogleDrive(userId);
  return gdrive.buildAuthUrl(cfg, redirectUri, state); // 409 gdrive_not_configured if creds missing
}

/** Complete the handshake: exchange the code, store the refresh token, ensure the folder (§9.2). */
export async function completeConnect(
  userId: string,
  code: string,
  redirectUri: string,
): Promise<void> {
  const cfg = await rawGoogleDrive(userId);
  const refreshToken = await gdrive.exchangeCode(cfg, code, redirectUri);
  await writeGoogleDrive(userId, { refresh_token: refreshToken });

  const updated = await rawGoogleDrive(userId);
  const accessToken = await gdrive.refreshAccessToken(updated);
  const folderId = await gdrive.findOrCreateFolder(accessToken, updated?.folder_id ?? null);
  await writeGoogleDrive(userId, { folder_id: folderId });
}

/** Revoke best-effort and clear the server-managed fields; keep client creds + config (§9.3). */
export async function disconnect(userId: string): Promise<void> {
  const cfg = await rawGoogleDrive(userId);
  if (cfg?.refresh_token?.trim()) await gdrive.revoke(cfg.refresh_token);
  await writeGoogleDrive(userId, {
    refresh_token: '',
    folder_id: null,
    enabled: false,
    last_backup_at: null,
    last_status: null,
    last_error: null,
  });
}

/** Current backup state for the Settings card (§9). */
export async function status(userId: string): Promise<GdriveStatusResponse> {
  const c = (await rawGoogleDrive(userId)) ?? NOT_CONFIGURED;
  return {
    connected: Boolean(c.refresh_token?.trim()),
    enabled: c.enabled,
    retention_days: c.retention_days,
    time_of_day: c.time_of_day,
    last_backup_at: c.last_backup_at ?? null,
    last_status: c.last_status ?? null,
    last_error: c.last_error ?? null,
    folder_url: c.folder_id ? `https://drive.google.com/drive/folders/${c.folder_id}` : null,
  };
}
