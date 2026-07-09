import { outboundFetch, jsonBody } from '../outbound-retry.js';
import {
  DRIVE_FILES_URL,
  DRIVE_UPLOAD_URL,
  FOLDER_MIME,
  FOLDER_NAME,
  GDRIVE_TIMEOUT_MS,
  GDRIVE_UPLOAD_TIMEOUT_MS,
  UPLOAD_BOUNDARY,
} from './constants.js';
import { DRIVE_ERROR_MAP, gdriveBadResponse } from './errors.js';

// Drive v3 operations (spec/logic/integrations-connections.md §9.4), all authenticated with
// a fresh access token. The `drive.file` scope means the app only sees the folder/files it
// creates, so folder lookup is scoped to that space.

const auth = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
});

interface DriveFile {
  id: string;
  name: string;
}

/** Find the app-owned "Macronome Backups" folder (by stored id, else by name) or create it. */
export async function findOrCreateFolder(
  accessToken: string,
  storedFolderId: string | null,
): Promise<string> {
  if (storedFolderId) return storedFolderId;

  const q = encodeURIComponent(
    `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`,
  );
  const listRes = await outboundFetch(
    'gdrive-folder-find',
    `${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)`,
    { headers: auth(accessToken) },
    GDRIVE_TIMEOUT_MS,
    DRIVE_ERROR_MAP,
  );
  const list = (await jsonBody(listRes, gdriveBadResponse)) as { files?: { id?: unknown }[] };
  const existing = list.files?.[0]?.id;
  if (typeof existing === 'string' && existing.length > 0) return existing;

  const createRes = await outboundFetch(
    'gdrive-folder-create',
    DRIVE_FILES_URL,
    {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    },
    GDRIVE_TIMEOUT_MS,
    DRIVE_ERROR_MAP,
  );
  const created = (await jsonBody(createRes, gdriveBadResponse)) as { id?: unknown };
  if (typeof created.id !== 'string' || created.id.length === 0) throw gdriveBadResponse();
  return created.id;
}

/** Multipart upload of the backup JSON body into the folder (§9.4). */
export async function uploadBackup(
  accessToken: string,
  folderId: string,
  filename: string,
  jsonBodyStr: string,
): Promise<void> {
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const multipart =
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${jsonBodyStr}\r\n` +
    `--${UPLOAD_BOUNDARY}--`;
  const res = await outboundFetch(
    'gdrive-upload',
    DRIVE_UPLOAD_URL,
    {
      method: 'POST',
      headers: {
        ...auth(accessToken),
        'Content-Type': `multipart/related; boundary=${UPLOAD_BOUNDARY}`,
      },
      body: multipart,
    },
    GDRIVE_UPLOAD_TIMEOUT_MS,
    DRIVE_ERROR_MAP,
  );
  await res.text().catch(() => '');
}

/** List the folder's backup files (id + name) for rotation (§9.4). */
export async function listBackups(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await outboundFetch(
    'gdrive-list',
    `${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)&pageSize=1000`,
    { headers: auth(accessToken) },
    GDRIVE_TIMEOUT_MS,
    DRIVE_ERROR_MAP,
  );
  const body = (await jsonBody(res, gdriveBadResponse)) as {
    files?: { id?: unknown; name?: unknown }[];
  };
  return (body.files ?? [])
    .filter((f): f is DriveFile => typeof f.id === 'string' && typeof f.name === 'string')
    .map((f) => ({ id: f.id, name: f.name }));
}

/** Delete one rotated-out backup file (§9.4). */
export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const res = await outboundFetch(
    'gdrive-delete',
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`,
    { method: 'DELETE', headers: auth(accessToken) },
    GDRIVE_TIMEOUT_MS,
    DRIVE_ERROR_MAP,
  );
  await res.text().catch(() => '');
}
