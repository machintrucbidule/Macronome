# ADR-0001 — Prebuilt combined image deployment (GHCR), not build-from-source

Status: **Accepted** (supersedes the original M0 deployment shape).
Date: 2026-06-05.

> This ADR is **authoritative** for how Macronome is packaged and deployed. It records
> a deliberate change to a normally-FIXED architecture area (`ARCHITECTURE.md`,
> `docs/architecture/*`), made on the owner's explicit instruction. **Do not revert to
> the superseded model.** A new session reading only part of the docs must follow this.

---

## Context

The original production setup (`compose.yml` + `Caddyfile`, delivered in M0) was a
**build-from-source** stack:

- the `api` service used `build: { context: ., dockerfile: packages/api/Dockerfile }`,
  so deploying required **the whole repo cloned on the target host**;
- the `proxy` (Caddy) served `./packages/web/dist`, but **no image built the web** — the
  SPA was "built separately on the host", requiring a **Node toolchain on the server**
  (`npm run build -w @macronome/web`) before the stack could run;
- `Caddyfile` and `.env` had to be present/mounted on the host.

This made a clean "deploy the `macronome` service in Portainer" impossible: the real
flow was clone → npm install → build web → `docker compose up --build`. The owner's
target ops model is the opposite — a single published image pulled by Portainer, like
`louislam/uptime-kuma:1` (image + ports + a volume + a few env vars).

## Decision

1. **Single combined image** published to **GHCR**
   (`ghcr.io/machintrucbidule/macronome`). The image builds `shared` + `api` + `web`;
   the **Node/Express API process serves both the static SPA and `/api/v1`** on one
   port. This is **not SSR** — the SPA stays a pure client (`BASE = '/api/v1'`,
   same-origin), so API-first and the future React Native client are unaffected.
2. **No bundled reverse proxy.** Caddy is removed from the stack. The operator fronts
   the single exposed port with their own proxy / TLS (Nginx Proxy Manager, Traefik,
   Cloudflare tunnel, …). Security headers (HSTS, CSP, nosniff, Referrer-Policy),
   previously set by Caddy, are now emitted by the app via `helmet`
   (`http/middleware/securityHeaders.ts`).
3. **Postgres** stays a separate `postgres:17` service, persisted to a **named Docker
   volume** (`pgdata`); the session secret uses a second named volume (`appdata`).
   Named volumes (not a bind-mount) so a non-expert operator can reset the data with a
   click in Portainer (Volumes → Remove) and there is no host path to choose; backups
   use `pg_dump` regardless of the storage type, so nothing is lost by not having a
   visible folder.
4. **`compose.yml` is image-based** (no `build:`), Portainer-friendly: images + ports +
   named volumes + env vars (all defaulted). `DATABASE_URL` is derived from `POSTGRES_*`.
5. **Publishing**: `.github/workflows/release.yml` pushes `:latest` on every push to
   `main` and `:vX.Y.Z` / `:vX.Y` on `v*` tags. The existing `ci.yml` (verify) is
   unchanged.
6. **Zero-config by default.** The stack runs with **no env vars to set** (the
   Uptime-Kuma experience). Every compose variable has a default; Postgres is
   internal-only (no published port) so its default credentials are safe; the one real
   secret, `SESSION_SECRET`, is **auto-generated and persisted** on first boot to the
   `appdata` volume (`config/session-secret.ts`, `/data/session_secret`) and reused
   across restarts. `PUBLIC_BASE_URL` is dropped (it was validated but never used).
   `COOKIE_SECURE` defaults to **false** so login works out of the box behind the
   operator's HTTPS proxy; the stricter posture (Secure cookies) is opt-in.

   _Why not go further?_ Postgres stays a separate service because it is a client-server
   DB (unlike Uptime Kuma's embedded SQLite); switching to SQLite is rejected — search
   depends on Postgres-only `unaccent` / `pg_trgm` / GIN-trigram features in the schema
   and migrations. Embedding Postgres into the app image is rejected as a
   two-processes-per-container anti-pattern; the deploy unit is the compose stack, which
   Portainer treats as one app anyway.

## Consequences

- Deploy = `docker compose up -d` (or Portainer "deploy stack") with **no env to set**;
  images are pulled, the API runs `prisma migrate deploy` on start, then serves UI + API.
  No repo, no Node, no host-side web build on the target.
- **Hardening (opt-in):** to mark session cookies `Secure`, set `COOKIE_SECURE=true`
  **and** `TRUSTED_PROXY` to the front proxy's address/CIDR (so the `secure` cookie and
  login rate-limit see the real client — the Docker default `loopback` does not trust a
  proxy container). Documented in `ops.md` §4.
- The SPA build dir is provided to the API via `WEB_DIST` (set in the image); when
  unset (dev), static serving is inert and Vite serves the SPA.
- Data lives in two Docker-managed named volumes: `pgdata` (the database) and `appdata`
  (the session secret). Reset = remove the volume(s) (Portainer → Volumes, or
  `docker compose down -v`); see the ops runbook (`ops.md`).
- Removed/obsolete: `Caddyfile`, the `proxy` service + its `caddy_data` volume, the
  host-side web build, the `PUBLIC_BASE_URL` env (unused), the `DATA_PATH` host path, and
  the requirement to provide `SESSION_SECRET` / DB credentials by hand.

## Superseded artifacts

`Caddyfile` (deleted); the build-from-source `compose.yml`; "API serves JSON only" and
"web built separately on the host" statements in the architecture docs (updated to this
ADR).
