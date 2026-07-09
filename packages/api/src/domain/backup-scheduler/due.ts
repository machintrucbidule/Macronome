// The pure "is a backup due now?" decision for the catch-up scheduler
// (spec/logic/backup-scheduler.md §2). Inputs are already reduced to the server-local
// calendar by the caller (the service converts the UTC instant / TZ); this function is a
// pure calendar comparison, so it carries neutral CI oracles and no clock.

export interface DueInput {
  /** The scheduler opt-in flag. */
  enabled: boolean;
  /** Server-local today, `YYYY-MM-DD`. */
  nowDate: string;
  /** Server-local wall-clock now, `HH:MM` (24-h, zero-padded). */
  nowTime: string;
  /** The configured schedule, `HH:MM`. */
  timeOfDay: string;
  /** Server-local date of the last successful backup, or null if there is none. */
  lastBackupDate: string | null;
}

/**
 * Due ⇔ enabled AND now is at/after the scheduled time today AND no successful backup ran
 * today. `HH:MM` and `YYYY-MM-DD` are zero-padded, so lexicographic comparison is correct.
 * A null `lastBackupDate` never equals `nowDate`, so a never-backed-up user is due once the
 * time has passed.
 */
export function isBackupDue(i: DueInput): boolean {
  if (!i.enabled) return false;
  if (i.nowTime < i.timeOfDay) return false;
  if (i.lastBackupDate === i.nowDate) return false;
  return true;
}
