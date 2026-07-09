// Google Drive backup — endpoint URLs, OAuth scope, folder identity, timeouts
// (spec/logic/integrations-connections.md §9). Least-privilege `drive.file` scope: the
// app only ever touches the folder/files it creates.

export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FOLDER_NAME = 'Macronome Backups';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Interactive calls (connect / status / folder / list / delete). */
export const GDRIVE_TIMEOUT_MS = 10_000;
/** The upload — the export body can be large. */
export const GDRIVE_UPLOAD_TIMEOUT_MS = 30_000;

/** Multipart boundary for the upload; distinctive so it never collides with the JSON body. */
export const UPLOAD_BOUNDARY = 'macronome-backup-boundary-7f3c1a';
