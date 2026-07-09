// Pure retention rotation for the Google Drive backup (spec/logic/backup-scheduler.md §3).
// Retention is `retentionDays` rolling calendar days; rotation is by age, so multiple
// backups on the same day are kept/pruned together. Dates are `YYYY-MM-DD` strings, so
// lexicographic comparison is exact and TZ-independent.

export interface BackupFile {
  id: string;
  /** The backup's own calendar date, `YYYY-MM-DD` (see backupDateFromName). */
  backupDate: string;
}

/** Shift a `YYYY-MM-DD` date by `days` (may be negative); parsed as UTC so no TZ drift. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Return the ids of the backups to delete: those whose `backupDate` is on or before the
 * cutoff `todayDate − retentionDays`. Keeps the last `retentionDays` days inclusive of
 * today (e.g. retentionDays 7, today 2026-01-15 → cutoff 2026-01-08, delete ≤ that).
 */
export function backupsToRotate(
  files: BackupFile[],
  retentionDays: number,
  todayDate: string,
): string[] {
  const cutoff = shiftDate(todayDate, -retentionDays);
  return files.filter((f) => f.backupDate <= cutoff).map((f) => f.id);
}

/** Extract the `YYYY-MM-DD` date from a backup filename, or null if it doesn't match. */
export function backupDateFromName(name: string): string | null {
  const m = /macronome-backup-(\d{4}-\d{2}-\d{2})T\d{6}Z\.json$/.exec(name);
  return m?.[1] ?? null;
}
