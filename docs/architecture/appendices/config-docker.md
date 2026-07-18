# Appendix — Docker, proxy & env (specification)

Specifications only. The authoritative deployment model is **ADR-0001**
(`docs/architecture/decisions/0001-prebuilt-image-deployment.md`): a single prebuilt
GHCR image serving SPA + `/api/v1`, no bundled proxy, Postgres on a named volume.

---

## `compose.yml` (production — image-based, zero-config)

Every variable has a default → the stack runs with **no env set**.

```yaml
services:
  macronome:
    image: ghcr.io/machintrucbidule/macronome:${MACRONOME_TAG:-latest}
    restart: unless-stopped
    ports: ['${APP_PORT:-3000}:3000']
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-macronome}:${POSTGRES_PASSWORD:-macronome}@postgres:5432/${POSTGRES_DB:-macronome}
      # SESSION_SECRET auto-generated & persisted to the app volume on first boot if unset
      TRUSTED_PROXY: ${TRUSTED_PROXY:-loopback, uniquelocal} # trusts loopback + private/container ranges
      COOKIE_SECURE: ${COOKIE_SECURE:-false} # safe to set true behind an HTTPS proxy (TRUSTED_PROXY covers it)
      PUBLIC_ORIGIN: ${PUBLIC_ORIGIN:-} # public HTTPS origin for the Drive OAuth callback behind a proxy (optional)
      NODE_ENV: production
    volumes: ['appdata:/data'] # persists the session secret
    depends_on:
      postgres: { condition: service_healthy }
    # image entrypoint runs `prisma migrate deploy` then starts the server
    # (recommended: dump the DB before migrate — see ops.md §5)

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-macronome}
      POSTGRES_USER: ${POSTGRES_USER:-macronome}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-macronome} # internal-only; default is safe
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-macronome}']
      interval: 10s
      retries: 5

volumes:
  pgdata:
  appdata:
```

No `build:` and no bundled proxy: `docker compose up -d` **pulls** the image and runs
with zero configuration. Front the exposed port with your own reverse proxy / TLS (Nginx
Proxy Manager, Traefik, Caddy, a Cloudflare tunnel, …), or expose it directly. The image
is published by `.github/workflows/release.yml` (`:latest` on `main`, `:vX.Y.Z` on `v*`
tags).

---

## `compose.test.yml` (test / dev DB only)

```yaml
services:
  postgres-test:
    image: postgres:17
    environment:
      POSTGRES_DB: macronome_test
      POSTGRES_USER: macronome
      POSTGRES_PASSWORD: test
    ports: ['5433:5432'] # non-default port to avoid clashing with a local PG
    tmpfs: ['/var/lib/postgresql/data'] # ephemeral: fast, wiped on restart
```

`unaccent` / `pg_trgm` are enabled by the Prisma migrations, so the test DB gets
them on `migrate deploy` in the test setup.

---

## Reverse proxy (operator-provided, not shipped)

No proxy ships in the stack (ADR-0001). Point any frontal at the single exposed port;
it serves both the SPA and `/api/v1`. The app emits its own security headers (HSTS,
CSP, nosniff, Referrer-Policy) via `helmet` (`http/middleware/securityHeaders.ts`), so
the proxy only needs to terminate TLS and forward. Login works out of the box
(`COOKIE_SECURE=false`); to use `Secure` cookies, set `COOKIE_SECURE=true` (have the proxy
send the usual `X-Forwarded-*` headers). The default `TRUSTED_PROXY=loopback, uniquelocal`
already trusts a proxy on loopback **or** a private/container range (a Docker sidecar such as
NPM/Traefik/cloudflared), so `Secure` cookies and real-client-IP rate-limiting work without
extra config. Narrow it to `loopback` (same-host only) or a specific CIDR to tighten — note the
default trusts any peer on a private range, which on a directly-published port lets a same-LAN
peer forge `X-Forwarded-*` (see `security.md` §3). For the **Google Drive OAuth
backup**, set `PUBLIC_ORIGIN` to the public HTTPS origin (e.g. `https://macronome.example.com`)
so the app builds the exact callback URL regardless of proxy-header trust (ops.md §6c, B-217).

---

## `.env.example` (versioned; all keys OPTIONAL)

The stack runs with no `.env`. Every key is a commented override:

```dotenv
# --- image & host ---
# MACRONOME_TAG=latest
# APP_PORT=3000
# (data lives in Docker-managed named volumes — nothing to configure here)

# --- database (internal only, not exposed; defaults are fine) ---
# POSTGRES_DB=macronome
# POSTGRES_USER=macronome
# POSTGRES_PASSWORD=macronome

# --- app ---
# SESSION_SECRET=             # leave unset: auto-generated & persisted on first boot
# COOKIE_SECURE=false         # safe to set true behind an HTTPS proxy (TRUSTED_PROXY must cover it)
# TRUSTED_PROXY=loopback, uniquelocal  # peers trusted for X-Forwarded-* (default: loopback + private ranges)
# PUBLIC_ORIGIN=              # public HTTPS origin for the Drive OAuth callback behind a proxy (optional)

# --- reserved (unused in v1) ---
# LLM_ENDPOINT_URL=
# LLM_ENDPOINT_KEY=
```

`packages/api/Dockerfile` is a multi-stage build that compiles `shared` + `api` + `web`,
runs `prisma generate`, and produces a slim runtime image whose API process serves both
the SPA (`WEB_DIST=/app/packages/web/dist`) and `/api/v1`.
