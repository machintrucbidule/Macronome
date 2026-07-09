// Reduce a UTC instant to a wall-clock calendar (date + HH:MM) in a given IANA timezone, for
// the backup scheduler's due decision (spec/logic/backup-scheduler.md §1.1, B-220). The daily
// schedule is the user's local time: the service converts "now" and the last backup into the
// user's zone, then the pure `isBackupDue` compares them. When no zone is stored (or it is not
// recognised by the runtime's Intl), we fall back to the server process timezone — the pre-B-220
// behaviour — so existing installs keep working until the user next saves the card.

export interface Calendar {
  /** `YYYY-MM-DD` in the target zone. */
  date: string;
  /** `HH:MM` (24-h, zero-padded) in the target zone. */
  time: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Server-local calendar (process TZ) — the fallback when no zone is given. */
function serverLocal(d: Date): Calendar {
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * `instant` reduced to `{ date, time }` in `timeZone` (an IANA name). Falls back to the server
 * process timezone when `timeZone` is absent or the runtime's Intl does not recognise it.
 */
export function calendarInZone(instant: Date, timeZone?: string | null): Calendar {
  if (!timeZone) return serverLocal(instant);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
  } catch {
    return serverLocal(instant);
  }
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
