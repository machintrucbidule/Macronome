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
3. **Postgres** stays a separate `postgres:17` service, persisted to a **bind-mount at
   a configurable host path** (`DATA_PATH`), not a named volume — so the data location
   is explicit for backups.
4. **`compose.yml` is image-based** (no `build:`), Portainer-friendly: images + ports +
   bind-mount + env vars. `DATABASE_URL` is derived from `POSTGRES_*`.
5. **Publishing**: `.github/workflows/release.yml` pushes `:latest` on every push to
   `main` and `:vX.Y.Z` / `:vX.Y` on `v*` tags. The existing `ci.yml` (verify) is
   unchanged.

## Consequences

- Deploy = set env vars + `docker compose up -d` (or Portainer "deploy stack"); images
  are pulled, the API runs `prisma migrate deploy` on start, then serves UI + API. No
  repo, no Node, no host-side web build on the target.
- **`TRUSTED_PROXY` must be set to the front proxy's address/CIDR** when fronted, so the
  `secure` cookie and login rate-limit see the real client (the Docker default
  `loopback` does not trust a proxy container). Documented in `ops.md` §4.
- The SPA build dir is provided to the API via `WEB_DIST` (set in the image); when
  unset (dev), static serving is inert and Vite serves the SPA.
- Removed/obsolete: `Caddyfile`, the `proxy` service, the host-side web build, the
  named `pgdata`/`caddy_data` volumes.

## Superseded artifacts

`Caddyfile` (deleted); the build-from-source `compose.yml`; "API serves JSON only" and
"web built separately on the host" statements in the architecture docs (updated to this
ADR).
