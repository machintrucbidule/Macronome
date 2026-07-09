// Backup filename builder (spec/logic/backup-scheduler.md §4). Dated so rotation can read
// the age, timestamped (UTC) so a same-day manual backup never overwrites the nightly one.
// Pure: derived from the given ISO instant, no clock.

/** `macronome-backup-{YYYY-MM-DD}T{HHMMSS}Z.json` for the given ISO-8601 instant. */
export function backupFilename(instantIso: string): string {
  const iso = new Date(instantIso).toISOString(); // normalise to UTC Z form
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 19).replace(/:/g, '');
  return `macronome-backup-${date}T${time}Z.json`;
}
