import { ErrorCode, type GdriveBackupResult } from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import {
  backupDateFromName,
  backupFilename,
  backupsToRotate,
} from '../domain/backup-scheduler/index.js';
import { buildExport } from './data/export.js';
import * as gdrive from './gdrive/index.js';
import { rawGoogleDrive, writeGoogleDrive } from './settings.js';

// Run one backup: export → upload → rotate, then persist the status (§9.4). Shared by the
// scheduler and POST /backup-now. The not-connected guard throws before any status write;
// a failure after that records last_status:"error" and re-throws (the controller maps it,
// the scheduler swallows it).

function toResult(
  last_backup_at: string | null,
  last_status: 'ok' | 'error',
  last_error: string | null,
): GdriveBackupResult {
  return { last_backup_at, last_status, last_error };
}

export async function runBackup(userId: string): Promise<GdriveBackupResult> {
  const cfg = await rawGoogleDrive(userId);
  gdrive.assertConnected(cfg); // 409 gdrive_not_connected — no status write

  try {
    const accessToken = await gdrive.refreshAccessToken(cfg);
    const folderId = await gdrive.findOrCreateFolder(accessToken, cfg.folder_id ?? null);

    const envelope = await buildExport(userId);
    if (!envelope) throw new ApiError(404, ErrorCode.NotFound);

    const nowIso = new Date().toISOString();
    await gdrive.uploadBackup(
      accessToken,
      folderId,
      backupFilename(nowIso),
      JSON.stringify(envelope),
    );

    const files = await gdrive.listBackups(accessToken, folderId);
    const dated = files
      .map((f) => ({ id: f.id, backupDate: backupDateFromName(f.name) }))
      .filter((f): f is { id: string; backupDate: string } => f.backupDate !== null);
    const todayDate = nowIso.slice(0, 10);
    for (const id of backupsToRotate(dated, cfg.retention_days, todayDate)) {
      await gdrive.deleteFile(accessToken, id);
    }

    await writeGoogleDrive(userId, {
      folder_id: folderId,
      last_backup_at: nowIso,
      last_status: 'ok',
      last_error: null,
    });
    return toResult(nowIso, 'ok', null);
  } catch (err) {
    const reason = err instanceof ApiError ? err.code : 'gdrive_bad_response';
    await writeGoogleDrive(userId, { last_status: 'error', last_error: reason });
    throw err;
  }
}
