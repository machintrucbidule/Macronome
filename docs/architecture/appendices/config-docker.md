# Appendix — Docker, proxy & env (specification)

Specifications only — not scaffolding. Adjust image tags/ports at build time.

---

## `compose.yml` (production)

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5

  api:
    build: { context: ., dockerfile: packages/api/Dockerfile }
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      TRUSTED_PROXY: ${TRUSTED_PROXY}        # e.g. the proxy container CIDR / "loopback"
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}
      COOKIE_SECURE: "true"
      NODE_ENV: production
    depends_on:
      postgres: { condition: service_healthy }
    # entrypoint runs `prisma migrate deploy` then `node dist/server.js`
    # (recommended: dump the DB before migrate — see ops.md §5)

  proxy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./packages/web/dist:/srv/web:ro      # SPA static build
      - caddy_data:/data
    depends_on: [api]

volumes:
  pgdata:
  caddy_data:
```

The `proxy` service is the **default, replaceable** frontal. To run behind a tunnel
or external load balancer, drop `proxy` (or leave it on plain HTTP) and point the
external frontal at the SPA build + the `api` service.

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
    ports: ["5433:5432"]      # non-default port to avoid clashing with a local PG
    tmpfs: ["/var/lib/postgresql/data"]   # ephemeral: fast, wiped on restart
```

`unaccent` / `pg_trgm` are enabled by the Prisma migrations, so the test DB gets
them on `migrate deploy` in the test setup.

---

## `Caddyfile` (default reverse proxy)

```caddyfile
{$PUBLIC_BASE_URL} {
    encode zstd gzip

    # API
    handle /api/* {
        reverse_proxy api:3000
    }

    # SPA (history fallback to index.html)
    handle {
        root * /srv/web
        try_files {path} /index.html
        file_server
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        # CSP: SPA self-hosted; tighten script/style/connect to self
        Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'"
    }
}
```

Caddy auto-provisions TLS when `PUBLIC_BASE_URL` is a real domain with reachable
ports; behind a tunnel it can serve plain HTTP locally (TLS terminated upstream).

---

## `.env.example` (versioned; keys only)

```dotenv
# --- database ---
POSTGRES_DB=macronome
POSTGRES_USER=macronome
POSTGRES_PASSWORD=
DATABASE_URL=postgresql://macronome:@postgres:5432/macronome

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

`packages/api/Dockerfile` is a multi-stage build (install workspace deps → build
`shared` + `api` → run `prisma generate` → slim runtime image). Its exact content is
a 3b build artifact.
