# Appendix — Docker, proxy & env (specification)

Specifications only. The authoritative deployment model is **ADR-0001**
(`docs/architecture/decisions/0001-prebuilt-image-deployment.md`): a single prebuilt
GHCR image serving SPA + `/api/v1`, no bundled proxy, bind-mount Postgres.

---

## `compose.yml` (production — image-based)

```yaml
services:
  macronome:
    image: ghcr.io/machintrucbidule/macronome:${MACRONOME_TAG:-latest}
    restart: unless-stopped
    ports: ['${APP_PORT:-3000}:3000']
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      SESSION_SECRET: ${SESSION_SECRET}
      TRUSTED_PROXY: ${TRUSTED_PROXY:-loopback} # set to your front proxy's CIDR when fronted
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}
      COOKIE_SECURE: ${COOKIE_SECURE:-true}
      NODE_ENV: production
    depends_on:
      postgres: { condition: service_healthy }
    # image entrypoint runs `prisma migrate deploy` then starts the server
    # (recommended: dump the DB before migrate — see ops.md §5)

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: ['${DATA_PATH:-./data}/db:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 10s
      retries: 5
```

No `build:` and no bundled proxy: `docker compose up -d` **pulls** the image. Front the
exposed port with your own reverse proxy / TLS (Nginx Proxy Manager, Traefik, Caddy, a
Cloudflare tunnel, …), or expose it directly. The image is published by
`.github/workflows/release.yml` (`:latest` on `main`, `:vX.Y.Z` on `v*` tags).

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
the proxy only needs to terminate TLS and forward — set `TRUSTED_PROXY` to the proxy's
address/CIDR and have it send the usual `X-Forwarded-*` headers.

---

## `.env.example` (versioned; keys only)

```dotenv
# --- image & host ---
MACRONOME_TAG=latest
APP_PORT=3000
DATA_PATH=./data

# --- database (DATABASE_URL is derived from these in compose.yml) ---
POSTGRES_DB=macronome
POSTGRES_USER=macronome
POSTGRES_PASSWORD=

# --- app ---
SESSION_SECRET=
TRUSTED_PROXY=loopback
PUBLIC_BASE_URL=https://macronome.example.org
COOKIE_SECURE=true
NODE_ENV=production

# --- reserved (unused in v1) ---
LLM_ENDPOINT_URL=
LLM_ENDPOINT_KEY=
```

`packages/api/Dockerfile` is a multi-stage build that compiles `shared` + `api` + `web`,
runs `prisma generate`, and produces a slim runtime image whose API process serves both
the SPA (`WEB_DIST=/app/packages/web/dist`) and `/api/v1`.
