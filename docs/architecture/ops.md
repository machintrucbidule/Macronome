# Ops, deployment & backups

The app is a standard, deployment-agnostic web service. Config appendices (compose,
Caddyfile, env) are in `appendices/config-docker.md`.

---

## 1. Production topology (Docker Compose) — ADR-0001

Two services, one critical bind-mount; **prebuilt image pulled from GHCR** (no
build-from-source). See `decisions/0001-prebuilt-image-deployment.md`.

```
compose.yml
├─ macronome  (Node/TS)    :<APP_PORT>  → serves the SPA build AND /api/v1;
│                                          runs migrate on start, then listens
└─ postgres   (PostgreSQL) internal     → bind-mount: ${DATA_PATH}/db  ← only critical state
```

- The image builds `shared` + `api` + `web`; the **API process serves both the static
  SPA and `/api/v1`** on one port (not SSR — the SPA is a pure same-origin client).
  No app state lives outside Postgres (the v1 contract has no user uploads/files), so
  the DB bind-mount is the entire backup surface.
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

**Prod (any Docker host, incl. Proxmox; Portainer "deploy stack"):**

- Set the env vars (see §4), then `docker compose up -d` — it **pulls** the prebuilt
  `macronome` image from GHCR (no `--build`, no repo or Node toolchain on the host).
  The `macronome` service runs `prisma migrate deploy` (one-shot) before listening,
  then serves the SPA + `/api/v1`. The `web` build ships inside the image.

---

## 4. Environment & secrets

12-factor: all config via env vars; nothing secret in the repo.

- Versioned template: `.env.example` (keys only).
- Dev: `.env` (gitignored).
- Prod: env injected by compose / Portainer stack vars / Docker secrets.

Deploy/host keys (compose.yml): `MACRONOME_TAG` (image tag, e.g. `latest` / `vX.Y.Z`),
`APP_PORT` (host port), `DATA_PATH` (host path for the Postgres bind-mount),
`POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` (`DATABASE_URL` is derived from
these in compose.yml).

App keys (v1): `DATABASE_URL`, `SESSION_SECRET` (long random), `TRUSTED_PROXY`
(address/CIDR, or `loopback`; set to the front proxy when fronted), `PUBLIC_BASE_URL`,
`NODE_ENV`, `COOKIE_SECURE` (true in prod), `WEB_DIST` (SPA build path; set inside the
image, unset in dev), and the reserved-but-unused `LLM_ENDPOINT_URL` /
`LLM_ENDPOINT_KEY`. Secrets are never logged (see `security.md`).

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

- **All critical state is in one Postgres database, one bind-mount** (`${DATA_PATH}/db`).
  No critical local disk state to coordinate. Therefore a single logical dump is a
  complete backup (and the bind-mount path itself can be snapshotted/copied if desired).
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

## 7. Bootstrap (first user)

There is no open/public sign-up (contract §7). The single owner account is created by a
one-shot, **zero-user-gated first-run setup wizard** (`POST /api/v1/auth/setup`, allowed
only while no user exists, then permanently disabled — built in M8). A tiny one-off
`create-user` script in `packages/api` (argon2id hash, no API surface) is kept as an
**admin / headless fallback**. Documented in the root `CLAUDE.md`.

(The Excel migration — `docs/dev-plan/O1-excel-migration.md`, out of the dev plan — is
**not** a bootstrap path; it imports historical data into an already-bootstrapped DB.)
