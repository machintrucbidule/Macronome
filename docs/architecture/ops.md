# Ops, deployment & backups

The app is a standard, deployment-agnostic web service. Config appendices (compose,
Caddyfile, env) are in `appendices/config-docker.md`.

---

## 1. Production topology (Docker Compose)

Three services, one critical volume:

```
compose.yml
├─ proxy      (Caddy)      :80/:443  → serves SPA build, proxies /api → api
├─ api        (Node/TS)    internal  → Express; runs migrate on start, then listens
└─ postgres   (PostgreSQL) internal  → volume: pgdata  ← the only critical state
```

- The SPA is built (`vite build`) to static assets and served by the proxy; the API
  serves JSON only. No app state lives outside Postgres (the v1 contract has no user
  uploads/files), so the DB volume is the entire backup surface.
- **The proxy is replaceable.** Open a port and Caddy serves it directly (auto-TLS
  if a domain is set); or front it with any tunnel / load balancer / nginx and point
  that at the `api` + static build. Nothing in the app assumes a specific frontal.
- **Trusted proxy.** The API sets `trust proxy` to the proxy's address/CIDR so the
  real client IP (for login rate-limiting) is read from forwarded headers **only
  when they come from the known proxy** — see `security.md`.

---

## 2. Reverse proxy + HTTPS

TLS terminates at the reverse proxy (the bundled Caddy, or whatever frontal the
operator puts in front). Caddy obtains/renews Let's Encrypt certs automatically when
given a domain and reachable ports; behind a tunnel, TLS is handled upstream and
Caddy speaks plain HTTP locally. Either way the app is unchanged. HSTS and the
security headers are set at the proxy (config in the appendix).

---

## 3. Dev workflow (Windows 11) vs prod (Proxmox/any host)

**Dev (fast inner loop):**

- Postgres via Docker Desktop: `docker compose -f compose.test.yml up -d` (or a dev
  compose with the same image) — the only container needed locally.
- API: `npm run dev -w @macronome/api` (ts watch, auto-reload).
- Web: `npm run dev -w @macronome/web` (Vite dev server; proxies `/api` → local API).
- The full `compose.yml` is **prod-only**; do not run it as the dev loop.

**Prod (any Docker host, incl. Proxmox):**

- `docker compose up -d --build`. The `api` service runs `prisma migrate deploy`
  (one-shot) before listening; the `web` build is produced at image-build time and
  served by `proxy`.

---

## 4. Environment & secrets

12-factor: all config via env vars; nothing secret in the repo.

- Versioned template: `.env.example` (keys only).
- Dev: `.env` (gitignored).
- Prod: env injected by compose / Docker secrets.

Keys (v1): `DATABASE_URL`, `SESSION_SECRET` (long random), `TRUSTED_PROXY`
(address/CIDR or `loopback`), `PUBLIC_BASE_URL`, `NODE_ENV`, `COOKIE_SECURE`
(true in prod), and the reserved-but-unused `LLM_ENDPOINT_URL` / `LLM_ENDPOINT_KEY`.
Secrets are never logged (see `security.md`).

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

- **All critical state is in one Postgres database, one volume.** No critical local
  disk state to coordinate. Therefore a single logical dump is a complete backup.
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
