# Ops, deployment & backups

The app is a standard, deployment-agnostic web service. Config appendices (compose, env)
are in `appendices/config-docker.md`.

---

## 1. Production topology (Docker Compose) — ADR-0001

Two services, one critical named volume; **prebuilt image pulled from GHCR** (no
build-from-source). See `decisions/0001-prebuilt-image-deployment.md`.

```
compose.yml
├─ macronome  (Node/TS)    :<APP_PORT>  → serves the SPA build AND /api/v1;
│                                          runs migrate on start, then listens
│                                          (named volume: appdata → session secret)
└─ postgres   (PostgreSQL) internal     → named volume: pgdata  ← only critical state
```

- The image builds `shared` + `api` + `web`; the **API process serves both the static
  SPA and `/api/v1`** on one port (not SSR — the SPA is a pure same-origin client).
  No app state lives outside Postgres (the v1 contract has no user uploads/files), so
  the `pgdata` volume is the entire backup surface.
- **No bundled proxy.** The single port is fronted by the operator's own reverse proxy
  / tunnel / load balancer (TLS there), or exposed directly. Nothing in the app assumes
  a specific frontal.
- **Trusted proxy.** When fronted, set `TRUSTED_PROXY` to the proxy's address/CIDR so
  the real client IP (for login rate-limiting) and the `secure` cookie are read from
  forwarded headers **only when they come from the known proxy** — see `security.md`.
  The Docker default `loopback` does **not** trust a separate proxy container.

---

## 2. Reverse proxy + HTTPS (operator-provided)

There is **no proxy in the stack**. TLS terminates at whatever frontal the operator
puts in front of the exposed port (Nginx Proxy Manager, Traefik, Caddy, a Cloudflare
tunnel, …), which forwards plain HTTP to the app locally. The app is unchanged either
way. **Security headers (HSTS, CSP, nosniff, Referrer-Policy) are emitted by the app**
via `helmet` (`http/middleware/securityHeaders.ts`) — not by a proxy.

---

## 3. Dev workflow (Windows 11) vs prod (Proxmox/any host)

**Dev (fast inner loop):**

- Postgres via Docker Desktop: `docker compose -f compose.test.yml up -d` (or a dev
  compose with the same image) — the only container needed locally.
- API: `npm run dev -w @macronome/api` (ts watch, auto-reload).
- Web: `npm run dev -w @macronome/web` (Vite dev server; proxies `/api` → local API).
- The full `compose.yml` is **prod-only**; do not run it as the dev loop.

**One-command local app run (Windows):** `macronome_start.bat` brings up a **persistent**
dev DB (`compose.dev.yml`, named volume `devdata`, port 5434) + API (watch) + Web (Vite)
and opens `http://localhost:5173`; `macronome_stop.bat` stops it (data kept);
`macronome_clean_db.bat` wipes the DB (→ first-run wizard). These point at the dev DB via
an inline `DATABASE_URL`, leaving `.env` untouched. _Distinct from the test gate:_
`test-db-*.bat` + `verify.bat` use the **ephemeral** tmpfs test DB (`compose.test.yml`,
port 5433) for the automated suites.

**Prod (any Docker host, incl. Proxmox; Portainer "deploy stack"):**

- `docker compose up -d` with **no env to set** (§4 — zero-config) — it **pulls** the
  prebuilt `macronome` image from GHCR (no `--build`, no repo or Node toolchain on the
  host). The `macronome` service runs `prisma migrate deploy` (one-shot) before
  listening, then serves the SPA + `/api/v1`. The `web` build ships inside the image.

---

## 4. Environment & secrets

**Zero-config (ADR-0001): the stack runs with no env vars set.** 12-factor still holds —
everything is env-overridable — but every key has a safe default, so `.env` is optional.

- Versioned template: `.env.example` (all keys commented as optional overrides).
- Dev: `.env` (gitignored).
- Prod: nothing required; override via compose / Portainer stack vars / Docker secrets.

Optional deploy/host overrides (compose.yml): `MACRONOME_TAG` (image tag; default
`latest`), `APP_PORT` (default `3000`), `POSTGRES_DB` / `POSTGRES_USER` /
`POSTGRES_PASSWORD` (default `macronome`; Postgres is internal-only, no published port,
so defaults are safe; `DATABASE_URL` is derived from them). Data lives in Docker-managed
named volumes (`pgdata`, `appdata`) — no host path to configure.

App keys: `SESSION_SECRET` — **auto-generated and persisted** on first boot when unset
(`config/session-secret.ts` → `appdata` volume, `/data/session_secret`), reused across
restarts; set it only to manage it yourself. `COOKIE_SECURE` defaults **false** (login works behind
your HTTPS proxy with no extra setup); to use `Secure` cookies set it `true` **and**
`TRUSTED_PROXY` to the proxy's address/CIDR. `WEB_DIST` (SPA build path) is set inside the
image, unset in dev. `LLM_ENDPOINT_URL` / `LLM_ENDPOINT_KEY` are reserved/unused. Secrets
are never logged (see `security.md`). _`PUBLIC_BASE_URL` was removed — it was validated
but never used._

---

## 5. Database migration workflow

Prisma Migrate; migrations are versioned, plain-SQL, reviewable before they run.

- **Author a change:** edit `schema.prisma` (kept faithful to `spec/schema/*`) →
  `prisma migrate dev --name <change>` generates a reviewable SQL migration. PG
  extensions (`unaccent`, `pg_trgm`) and GIN trigram indexes are created in
  migration SQL, not in `schema.prisma`.
- **Apply in prod:** `prisma migrate deploy` (idempotent, forward-only) runs as the
  one-shot step before the API starts.
- **Safety rule (workflow, not infra):** **take a database dump immediately before
  `migrate deploy`.** A bad migration on the daily-use DB is the realistic
  worst-case; a pre-migration dump makes it a one-command rollback. This is a
  documented step / optional entrypoint hook, kept simple.

---

## 6. Backup & restore — what the architecture guarantees

The architecture's job here is to make backup **trivial and standard**; the
schedule, retention, destination, and any extra safety nets are the operator's.

Guaranteed by design:

- **All critical state is in one Postgres database, one named volume** (`pgdata`).
  No critical local disk state to coordinate. Therefore a single logical dump is a
  complete backup. The only other persisted file is the auto-generated session secret
  (the `appdata` volume, `/data/session_secret`); it is **not critical** — if lost it is
  regenerated and users simply re-login.
- **Standard tools work, no app-specific tooling:**
  - backup: `pg_dump` (custom or plain format), e.g.
    `docker compose exec postgres pg_dump -U <user> -Fc <db> > macronome-YYYYMMDD.dump`
  - restore: `pg_restore` into a clean database, e.g.
    `docker compose exec -T postgres pg_restore -U <user> -d <db> --clean --if-exists < macronome-YYYYMMDD.dump`
- **A restore drill is part of "done" for the ops setup** — an untested backup is not
  a backup. The documented restore command above must be exercised once against a
  scratch DB before go-live.

Explicitly the **operator's** choice, out of architecture scope: backup schedule
(e.g. nightly), retention, off-host copy (NAS), Proxmox VM/CT snapshots, and PITR/WAL
archiving. None are needed by the app; standard dumps cover the data-loss risk for a
single-user daily tracker. (Recommended-but-not-required: a dump before each
`migrate deploy`, per §5.)

---

## 6b. Operations runbook (plain steps)

Everyday operations, both from Portainer (click) and the CLI. The two named volumes are
shown prefixed by the stack name (e.g. `macronome_pgdata`, `macronome_appdata`).

**Update to a new version (keeps all data).**

- Portainer: open the stack → **Update the stack**, tick **Re-pull image** → redeploy.
  Containers are recreated; the volumes (your data) are untouched; new DB migrations
  apply automatically on start.
- CLI (in the compose dir): `docker compose pull && docker compose up -d`.
- _Recommended first:_ take a backup (below) — a bad migration is the only real risk.

**Reset the database (start fresh — DELETES all data).**

- Portainer: stop/remove the stack → **Volumes** → remove `…_pgdata` (and `…_appdata`
  too if you also want a new login secret) → redeploy the stack. You get an empty DB and
  the first-run wizard again.
- CLI: `docker compose down -v` (removes the named volumes) then `docker compose up -d`.
  _Note:_ `down` **without** `-v` keeps the data; only `-v` deletes the volumes.

**Backup / restore.**

- Backup: `docker compose exec postgres pg_dump -U macronome -Fc macronome > macronome-YYYYMMDD.dump`
- Restore: `docker compose exec -T postgres pg_restore -U macronome -d macronome --clean --if-exists < macronome-YYYYMMDD.dump`

---

## 7. Bootstrap (first user)

There is no open/public sign-up (contract §7). The single owner account is created by a
one-shot, **zero-user-gated first-run setup wizard** (`POST /api/v1/auth/setup`, allowed
only while no user exists, then permanently disabled — built in M8). A tiny one-off
`create-user` script in `packages/api` (argon2id hash, no API surface) is kept as an
**admin / headless fallback**. Documented in the root `CLAUDE.md`.

(The Excel migration — done via the in-app **Settings → import** (IMP-1), out of the dev
plan — is **not** a bootstrap path; it imports historical data into an already-bootstrapped DB.)
