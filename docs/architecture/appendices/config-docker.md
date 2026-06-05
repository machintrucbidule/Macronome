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
      TRUSTED_PROXY: ${TRUSTED_PROXY:-loopback}
      COOKIE_SECURE: ${COOKIE_SECURE:-false} # set true only together with TRUSTED_PROXY
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
(`COOKIE_SECURE=false`); to use `Secure` cookies, set `COOKIE_SECURE=true` **and**
`TRUSTED_PROXY` to the proxy's address/CIDR (and have it send the usual `X-Forwarded-*`
headers).

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
# COOKIE_SECURE=false         # set true ONLY together with TRUSTED_PROXY
# TRUSTED_PROXY=loopback      # your reverse proxy's address/CIDR when fronted

# --- reserved (unused in v1) ---
# LLM_ENDPOINT_URL=
# LLM_ENDPOINT_KEY=
```

`packages/api/Dockerfile` is a multi-stage build that compiles `shared` + `api` + `web`,
runs `prisma generate`, and produces a slim runtime image whose API process serves both
the SPA (`WEB_DIST=/app/packages/web/dist`) and `/api/v1`.
