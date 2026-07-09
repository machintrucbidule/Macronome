# ADR-0004 — Opt-in Google Drive backup (outbound OAuth + in-process scheduler)

Status: **Accepted**.
Date: 2026-07-09.

> This ADR records the decision to add an **optional, per-user, nightly off-host backup**
> of the data-export envelope to the operator's own Google Drive (BACKLOG B-208). It
> introduces the codebase's first **outbound OAuth** integration and its first
> **in-process scheduler**, both **dormant by default**. It does not change ADR-0001
> (single prebuilt image, zero-config, operator-fronted proxy) for anyone who leaves the
> feature off. A future session must not: make it mandatory, bundle Google credentials in
> the image, request a broader Drive scope than `drive.file`, add a separate scheduler
> container/cron, or make the DB dumps of `ops.md §6` conditional on it.

---

## Context

Macronome guarantees a trivial, standard backup surface: all critical state is one Postgres
volume, and a `pg_dump` is a complete backup (`ops.md §6`). Schedule/retention/off-host copy
are explicitly the operator's responsibility. The owner wants an **in-app convenience**: a
hands-off nightly copy of their **user-facing data** (the IMP-1 export envelope) pushed
**off-host** to a place they already own — Google Drive — without standing up cron, a NAS,
or extra tooling.

Two constraints shape the design. (1) On a **personal Gmail**, service-account-owned files
count against the service account's own (0 GB) quota, so a service account cannot store a
personal backup — the user must authorise the app against **their own** Drive, i.e. **OAuth**.
(2) The app is a **single always-on Node process** (ADR-0001) with **no scheduler** of any
kind today; a nightly job is greenfield infrastructure.

## Decision

1. **Opt-in, dormant by default.** The feature is off until the user connects an account and
   flips `enabled`. With it off, nothing runs and ADR-0001's plain-HTTP zero-config default is
   untouched. Config lives in **Settings → Sauvegarde Google Drive**, per-user, on
   `settings.integrations.google_drive` (`spec/schema/tables-catalog.md`).

2. **OAuth with the operator's own client (`drive.file`).** Each operator brings their own
   Google OAuth client (`client_id`/`client_secret`) — **Macronome ships none**. The one-click
   **Connect** flow obtains a refresh token; the scope is least-privilege **`drive.file`**, so
   the app only ever sees the files/folder it creates. _Why not a service account?_ Personal-Gmail
   quota (above). _Why not full-Drive scope + a folder picker?_ It needs Google's restricted-scope
   verification and grants far more than a backup requires.

3. **App-derived HTTPS callback → an opt-in hardened posture.** The app derives its OAuth
   `redirect_uri` from the request origin, honouring `X-Forwarded-Proto`/`Host` **only** from the
   trusted proxy (`TRUSTED_PROXY`, same gate as the secure cookie). OAuth requires an exact,
   Google-registered **HTTPS** URL, so **Connect only completes on a hardened deployment**
   (HTTPS + trusted proxy). Attempting it over plain HTTP returns `gdrive_insecure_context`. This
   keeps ADR-0001's default deployment valid while gating the cloud handshake behind real TLS.

4. **Publish the consent screen to Production (durable token).** Google expires refresh tokens
   after 7 days while the consent screen is in "Testing"; the operator publishes it to
   "Production" (staying **unverified** — the warning is expected) for a durable token. Documented
   in-app and in `ops.md §6c`.

5. **In-process catch-up scheduler.** A single ~15-minute timer started at boot (`server.ts`)
   runs a user's backup when it is **past the scheduled time today AND no successful backup ran
   today** (state = the persisted `last_backup_at`). This **survives restarts**, **never
   double-runs**, and **catches up** a missed run without a cron container — consistent with the
   single-process ADR-0001 shape. Pure decision + rotation are specified and CI-tested in
   `spec/logic/backup-scheduler.md`; the connection/OAuth/Drive I/O in
   `integrations-connections.md §9`.

6. **Backup = the export envelope, rotated by age.** The uploaded file is exactly
   `buildExport(userId)` (reuse, no new format); retention keeps the last `retention_days` rolling
   days (default 7) and prunes older files after a successful upload.

7. **Secrets in cleartext in v1 (accepted).** The export envelope embeds the `settings` blob, so
   the backup file contains the Google refresh token, the AI key, and the HA token in cleartext —
   the same non-encrypted-at-rest posture as the rest of v1 (self-hosted, single owner, private
   volume). It is made **visible** to the user via a note on the card. Encryption at rest is a
   possible future hardening.

## Consequences

- **New contracts:** `spec/logic/integrations-connections.md §9` (google_drive connection, OAuth,
  Drive ops), new `spec/logic/backup-scheduler.md` (catch-up + rotation + oracles),
  `spec/api/integrations.md` (connect/callback/status/disconnect/backup-now),
  `spec/schema/tables-catalog.md §settings JSON` (`integrations.google_drive`), the Settings screen
  spec, and `ops.md §6c`. Recorded in `DECISIONS.md` → "B-208".
- **New backend surface (later batches):** OAuth routes, a `gdrive-client`, a `backup` service, and
  an in-process `scheduler` hooked in `server.ts`. First outbound OAuth and first scheduler in the
  codebase; both are inert when the feature is off.
- **No schema/migration change:** the config lives in the existing `settings` jsonb blob. No new
  table, no Prisma change.
- **Deployment unchanged for non-users:** single GHCR image, zero-config, operator-fronted proxy
  (ADR-0001) all still hold. The feature only asks more (HTTPS + trusted proxy + a Google client)
  of operators who opt in.

See also: ADR-0001 (prebuilt image deployment), `spec/logic/integrations-connections.md §9`,
`spec/logic/backup-scheduler.md`, `docs/architecture/ops.md §6/§6c`, DECISIONS.md → "B-208".
