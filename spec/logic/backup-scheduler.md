# Logic spec — Google Drive backup scheduler (B-208)

The **in-process, catch-up scheduler** and the **retention rotation** for the opt-in
Google Drive backup. The connection, OAuth handshake, and Drive operations are in
`spec/logic/integrations-connections.md §9`; the endpoints in `spec/api/integrations.md`;
the config/status fields in `spec/schema/tables-catalog.md §settings JSON`
(`integrations.google_drive`). This file owns the two **pure decisions** (`isBackupDue`,
`backupsToRotate`) that CI oracles cover, plus the scheduler loop described in prose.

Macronome is a single always-on Node process (ADR-0001); the scheduler is therefore
**in-process** (no new infrastructure, no cron container). It is **greenfield** — there is
no prior scheduler in the codebase.

## 1. The scheduler loop (catch-up)

A single timer, started once at server boot (`server.ts`), fires a **tick roughly every
60 seconds** (B-221 — minute-grained so a run fires within ~1 min of the configured `HH:MM`;
was ~15 min). On each tick, for every user whose `google_drive.enabled` is true and who is
connected (`refresh_token` set):

1. Convert the persisted `last_backup_at` (ISO-8601 **UTC** instant) and the current
   instant to the calendar of the connection's stored **`time_zone`** (an IANA name, e.g.
   `Europe/Paris`, captured from the user's browser when they save the schedule — B-220), so
   the daily `time_of_day` is read in **the user's local time**, not the server's. When
   `time_zone` is absent (a connection last saved before B-220) or the runtime does not
   recognise it, fall back to the **server-local** calendar (the process time zone — `TZ`,
   default UTC; the operator sets `TZ`, see `ops.md`). Both instants are reduced with the
   **same** zone, so "now" and "last backup" are comparable. The domain decision (`§2`) is a
   **pure calendar comparison** — the service does the UTC→zone conversion (`calendarInZone`),
   the domain function does not.
2. If `isBackupDue` (`§2`) → run one backup: `buildExport(userId)` → upload → rotate
   (`integrations-connections.md §9.4`). On success, persist `last_backup_at = now`,
   `last_status = "ok"`, `last_error = null`. On failure, persist `last_status = "error"`
   and a short `last_error`, and **leave `last_backup_at` unchanged**.

Properties this design guarantees:

- **Survives restarts.** State is the persisted `last_backup_at`, not an in-memory
  timer; a process that starts at 23:00 with today's run still pending will run it on the
  next tick (catch-up).
- **Never double-runs.** After a success `last_backup_at` is today, so `isBackupDue` is
  false for the rest of the day.
- **Never misses a day silently.** As long as the process is up for at least one tick
  after the scheduled time, the day's backup runs.
- **Retries a failure within the day.** A failed attempt leaves `last_backup_at` on an
  earlier day, so `isBackupDue` stays true and the **next tick retries**, until it
  succeeds or the day ends. Only **one** backup per day is retained (one-per-day model —
  a missed _past_ day is not separately recovered; catch-up recovers **today's** run).

The tick interval is an implementation constant (~60 s, B-221), not a contract oracle; the
oracles test the pure decision, which is interval-independent.

## 2. `isBackupDue` — the due decision (pure)

Inputs (already reduced to the server-local calendar by the caller):

- `enabled` — boolean.
- `nowDate` — `"YYYY-MM-DD"` (server-local today).
- `nowTime` — `"HH:MM"` (server-local wall-clock now, 24-h zero-padded).
- `timeOfDay` — `"HH:MM"` (the configured schedule).
- `lastBackupDate` — `"YYYY-MM-DD"` of the last **successful** backup in server-local time,
  or `null` if there has never been one.

Rule (returns boolean):

- `enabled` is false → **false**.
- `nowTime < timeOfDay` (lexicographic on zero-padded `HH:MM`) → **false** (before the
  scheduled time today).
- `lastBackupDate === nowDate` → **false** (a successful backup already ran today).
- otherwise → **true**.

Equivalently: due ⇔ `enabled && nowTime ≥ timeOfDay && lastBackupDate ≠ nowDate`. A `null`
`lastBackupDate` can never equal `nowDate`, so a never-backed-up user is due once the time
has passed.

## 3. `backupsToRotate` — retention rotation (pure)

Retention is **`retention_days` rolling calendar days** (default 7). Rotation is **by age**,
so multiple backups on the same day (e.g. a manual "Backup now" on top of the nightly one)
are all kept while that day is in the window, and all pruned once it leaves.

Inputs:

- `files` — list of `{ id, backupDate }` where `backupDate` is the backup's own
  server-local calendar date (parsed from the filename timestamp,
  `integrations-connections.md §9.4`, or from Drive metadata).
- `retentionDays` — integer ≥ 1.
- `todayDate` — `"YYYY-MM-DD"` (server-local today).

Rule: keep a file iff `backupDate > (todayDate − retentionDays)`; return the `id`s of all
**other** files (the ones to delete). The window is the last `retentionDays` calendar days
**inclusive of today** — for `retentionDays = 7` and `todayDate = 2026-01-15`, the cutoff
day is `2026-01-08` and files with `backupDate ≤ 2026-01-08` are deleted (kept:
`01-09 … 01-15`, i.e. 7 days). Rotation runs **only after a successful upload**, never
before (a failed upload never prunes history).

## 4. Backup contents & filename

- **Contents** = exactly `buildExport(userId)` — the same envelope as `GET /data/export`
  (`spec/api/data-export-import.md`). No backup-specific format; whatever the export
  includes, the backup includes (this is why the backup file carries the `settings` blob
  and therefore secrets in cleartext — see the note in `integrations-connections.md §9`
  and `settings.md`).
- **Filename** = `macronome-backup-{YYYY-MM-DD}T{HHMMSS}Z.json` (UTC instant of the run) —
  dated so rotation can read the age, timestamped so a same-day manual backup does not
  overwrite the nightly one.

## 5. Worked examples (oracles)

### 5.1 `isBackupDue`

1. **Due (normal night).** `enabled:true, nowDate:"2026-01-15", nowTime:"04:00",
timeOfDay:"03:00", lastBackupDate:"2026-01-14"` → **true**.
2. **Before scheduled time.** same but `nowTime:"02:30"` → **false**.
3. **Already backed up today.** same as (1) but `lastBackupDate:"2026-01-15"` → **false**.
4. **Never backed up.** `enabled:true, nowDate:"2026-01-15", nowTime:"04:00",
timeOfDay:"03:00", lastBackupDate:null` → **true**.
5. **Disabled.** `enabled:false` (any other inputs) → **false**.
6. **Catch-up after downtime.** `enabled:true, nowDate:"2026-01-15", nowTime:"23:00",
timeOfDay:"03:00", lastBackupDate:"2026-01-13"` → **true** (runs today's backup now; the
   missed 14th is not separately recovered — one-per-day model).
7. **Exactly at the scheduled minute.** `nowTime:"03:00", timeOfDay:"03:00",
lastBackupDate:"2026-01-14"` → **true** (`≥` is inclusive).

### 5.2 `backupsToRotate`

1. **Prune older than the window.** `retentionDays:7, todayDate:"2026-01-15"`, files with
   `backupDate` ∈ `{2026-01-15, 2026-01-14, 2026-01-09, 2026-01-08, 2026-01-01}` → delete
   the ids of `2026-01-08` and `2026-01-01` (cutoff day `2026-01-08`, inclusive-delete);
   keep `01-09 … 01-15`.
2. **Multiple backups on the same day.** `retentionDays:7, todayDate:"2026-01-15"`, files
   `{2026-01-15 (nightly), 2026-01-15 (manual), 2026-01-08}` → delete only the
   `2026-01-08` id; both `2026-01-15` files are kept.
3. **Nothing to prune.** all files within the window → delete nothing (`[]`).
4. **Empty.** `files:[]` → `[]`.
5. **Retention 1.** `retentionDays:1, todayDate:"2026-01-15"`, files
   `{2026-01-15, 2026-01-14}` → delete the `2026-01-14` id (cutoff `2026-01-14`), keep only
   today's.
