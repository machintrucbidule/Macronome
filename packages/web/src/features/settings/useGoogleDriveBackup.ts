import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GoogleDrivePatch, GoogleDriveRead } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { googleDriveApi } from '../../api/integrations';
import { SETTINGS_KEY, useSettingsMutation, useSettingsQuery } from './useSettings';

// State + handlers for the Google Drive backup card (specifications/screens/settings.md,
// B-208). Same doctrine as useGatewayForm: draft seeded from the redacted config, write-only
// client_secret. The connection is OAuth (Connect navigates to Google; the callback populates
// the refresh token) rather than a persist-then-test proof. Display state is read from the
// redacted settings.integrations.google_drive. Split into a config form + actions to keep each
// function small; composed by useGoogleDriveBackup.
const KNOWN_GDRIVE_ERRORS = new Set([
  'gdrive_not_configured',
  'gdrive_insecure_context',
  'gdrive_not_connected',
  'gdrive_oauth_failed',
  'gdrive_token_expired',
  'gdrive_unauthorized',
  'gdrive_quota_exceeded',
  'gdrive_unavailable',
  'gdrive_unreachable',
  'gdrive_bad_response',
]);

const gdriveError = (err: unknown): string | null =>
  err instanceof ApiError && KNOWN_GDRIVE_ERRORS.has(err.code) ? err.code : null;

const EMPTY_GDRIVE: GoogleDriveRead = {
  client_id: '',
  client_secret_set: false,
  refresh_token_set: false,
  folder_id: null,
  enabled: false,
  retention_days: 7,
  time_of_day: '03:00',
  last_backup_at: null,
  last_status: null,
  last_error: null,
};

/** Derived display state from the redacted config (pure). */
function derive(gd: GoogleDriveRead | null) {
  const c = gd ?? EMPTY_GDRIVE;
  return {
    configured: c.client_secret_set && Boolean(c.client_id),
    connected: c.refresh_token_set,
    lastBackupAt: c.last_backup_at,
    lastStatus: c.last_status,
    lastError: c.last_error,
    folderUrl: c.folder_id ? `https://drive.google.com/drive/folders/${c.folder_id}` : null,
  };
}

function useGdriveConfig(gd: GoogleDriveRead | null) {
  const save = useSettingsMutation();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretDirty, setSecretDirty] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);
  const [timeOfDay, setTimeOfDay] = useState('03:00');
  const [retentionInvalid, setRetentionInvalid] = useState(false);
  const [timeInvalid, setTimeInvalid] = useState(false);

  const seedKey = JSON.stringify(gd);
  useEffect(() => {
    const p: GoogleDriveRead | null =
      seedKey === 'null' ? null : (JSON.parse(seedKey) as GoogleDriveRead);
    setClientId(p?.client_id ?? '');
    setClientSecret('');
    setSecretDirty(false);
    setEnabled(p?.enabled ?? false);
    setRetentionDays(p?.retention_days ?? 7);
    setTimeOfDay(p?.time_of_day ?? '03:00');
    setRetentionInvalid(false);
    setTimeInvalid(false);
  }, [seedKey]);

  const setClientSecretValue = (v: string): void => {
    setClientSecret(v);
    setSecretDirty(true);
  };

  const saveConfig = (): void => {
    setRetentionInvalid(false);
    setTimeInvalid(false);
    const patch: GoogleDrivePatch = {
      client_id: clientId,
      enabled,
      retention_days: retentionDays,
      time_of_day: timeOfDay,
    };
    if (secretDirty) patch.client_secret = clientSecret;
    save.mutate(
      { integrations: { google_drive: patch } },
      {
        onError: (err) => {
          if (!(err instanceof ApiError)) return;
          if (err.details?.['integrations.google_drive.retention_days']) setRetentionInvalid(true);
          if (err.details?.['integrations.google_drive.time_of_day']) setTimeInvalid(true);
        },
      },
    );
  };

  return {
    clientId,
    setClientId,
    clientSecret,
    setClientSecretValue,
    clientSecretSet: gd?.client_secret_set ?? false,
    secretDirty,
    enabled,
    setEnabled,
    retentionDays,
    setRetentionDays,
    retentionInvalid,
    timeOfDay,
    setTimeOfDay,
    timeInvalid,
    saveConfig,
    savePending: save.isPending,
  };
}

function useGdriveActions(gd: GoogleDriveRead | null) {
  const qc = useQueryClient();
  const [connectError, setConnectError] = useState<string | null>(null);
  const invalidate = (): Promise<void> => qc.invalidateQueries({ queryKey: SETTINGS_KEY });
  const backup = useMutation({
    mutationFn: () => googleDriveApi.backupNow(),
    onSuccess: () => void invalidate(),
  });
  const disconnectMut = useMutation({
    mutationFn: () => googleDriveApi.disconnect(),
    onSuccess: () => void invalidate(),
  });

  const connect = (): void => {
    setConnectError(null);
    void (async () => {
      try {
        const res = await googleDriveApi.connect();
        window.location.assign(res.data.auth_url);
      } catch (err) {
        setConnectError(gdriveError(err) ?? 'gdrive_oauth_failed');
      }
    })();
  };

  return {
    ...derive(gd),
    connect,
    connectError,
    onBackupNow: (): void => backup.mutate(),
    backupPending: backup.isPending,
    backupError: gdriveError(backup.error),
    onDisconnect: (): void => disconnectMut.mutate(),
    disconnectPending: disconnectMut.isPending,
  };
}

export function useGoogleDriveBackup() {
  const gd = useSettingsQuery().data?.data.integrations.google_drive ?? null;
  return { ...useGdriveConfig(gd), ...useGdriveActions(gd) };
}

export type GoogleDriveForm = ReturnType<typeof useGoogleDriveBackup>;
