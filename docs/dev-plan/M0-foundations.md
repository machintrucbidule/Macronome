# M0 — Walking skeleton & toolchain

**Goal:** a thin end-to-end slice that proves the whole loop — repo, DB, one route
reaching the browser, auth skeleton, every test layer, the schema-alignment gate, the
Windows-11 dev loop, and a verified Proxmox deploy with a backup/restore drill —
before any feature work. Depends-on: none.

## Scope

Scaffold the monorepo exactly as specified (no feature logic):

1. **Monorepo & toolchain** (from `docs/architecture/appendices/config-manifests.md`):
   root `package.json` (npm workspaces `packages/*`, Node ≥22, the root scripts),
   `tsconfig.base.json`, per-package `package.json` + `tsconfig.json` for
   `shared` / `api` / `web` / `etl`.
2. **Lint/format/size rules** (from `appendices/config-lint.md`, rules in
   `modularity.md` §4): flat `eslint.config.js` with `max-lines:300` (error),
   `max-lines-per-function:80` (warn), `complexity:12`, import-boundary rules
   (`web`↛`api`, `domain`↛`data`/`http`, `controllers`↛Prisma) + exemption globs;
   `.prettierrc`.
3. **Containers & proxy** (from `appendices/config-docker.md`): `compose.yml`
   (proxy + api + postgres, `pgdata` volume), `compose.test.yml` (test Postgres
   only), `Caddyfile`, `.env.example` (keys only, per `ops.md` §4).
4. **DB up + first migration:** `packages/api/prisma/schema.prisma` for the M0 tables
   only (`app_user`, plus a session table for `connect-pg-simple`); first Prisma
   migration; `unaccent` + `pg_trgm` created in migration SQL (used later by search).
5. **Auth skeleton** (`security.md`): server-side sessions
   (`express-session` + `connect-pg-simple`), argon2id hashing, CSRF middleware,
   rate-limit/lockout, trusted-proxy IP handling, middleware order in `app.ts`.
   `create-user` one-off script (argon2id; no API surface) per `ops.md` §7.
6. **One trivial end-to-end route:** `GET /api/v1/health` (no auth) **and** an
   authenticated `GET /api/v1/auth/session`; the SPA shell calls one of them and
   renders the result, proving proxy → api → db → browser.
7. **App shell:** `main.tsx` providers (theme via `data-theme`, i18n fr/en scaffold,
   TanStack Query, router), `AppShell.tsx` (appbar + nav frame), `styles/tokens.css`
   **copied verbatim** from `design/tokens.css`, `global.css`.
8. **Test harness — all three layers + gates:**
   - Vitest unit (a sample neutral `*.test.ts`), Vitest+supertest integration against
     `compose.test.yml`, Playwright e2e (drives the health/login round-trip).
   - **Prisma↔DDL check** `npm run check:schema` (`testing.md` §5): diff
     `schema.prisma` against `spec/schema/*`, fail on drift, whitelist the
     extension/trigram SQL. Wired into CI and the *done* rule.
   - `npm run typecheck`, `npm run lint`, **pre-commit** (husky + lint-staged: eslint
     + prettier + `tsc --noEmit` on changed files).
   - CI workflow (GitHub Actions): lint + typecheck + check:schema + unit +
     integration on push; e2e on PRs. **Only `*.test.ts` run in CI**; `*.local.test.ts`
     are git-ignored.
9. **Local Windows-11 dev loop running** (`ops.md` §3): `npm run db:dev`,
   `npm run dev:api`, `npm run dev:web` (Vite proxies `/api`). Confirm hot reload and
   the round-trip in the browser. (Prereqs installed via `SETUP.md`.)
10. **Proxmox deploy verified** (`ops.md` §1–2): `docker compose up -d --build` on the
    target host; `migrate deploy` runs before listen; proxy serves the SPA and proxies
    `/api`; the health round-trip works over the deployed stack.
11. **Backup/restore drill** (`ops.md` §6): `pg_dump` the deployed DB, `pg_restore`
    into a scratch DB, confirm it loads. An untested backup is not done.

## Files (via `module-map.md` + appendices)

Root: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`,
`.env.example`, `compose.yml`, `compose.test.yml`, `Caddyfile`, `.github/workflows/ci.yml`,
`scripts/check-schema.*`.
`packages/shared/`: `package.json`, `tsconfig.json`, `src/index.ts`, a first constant
module + its neutral `*.test.ts`.
`packages/api/`: `src/server.ts`, `src/app.ts`, `src/config/env.ts` (Zod),
`src/http/middleware/{trustProxy,session,auth,csrf,rateLimit,tenant,errorHandler}.ts`,
`src/http/routes/{health,auth}.ts`, `src/http/controllers/auth.ts`,
`src/services/auth.ts`, `src/data/prisma.ts`, `src/data/repositories/user.repo.ts`,
`prisma/schema.prisma`, `prisma/migrations/*`, `scripts/create-user.ts`,
`test/integration/auth.test.ts`.
`packages/web/`: `src/main.tsx`, `src/app/{router.tsx,AppShell.tsx,providers/*}`,
`src/styles/{tokens.css,global.css}`, `src/i18n/{config.ts,locales/{fr,en}.json}`,
`src/api/client.ts`, `src/features/login/` (minimal).
`packages/etl/`: `package.json` + `src/run.ts` stub only (built in M8).
`e2e/`: `health.spec.ts`.

## Acceptance criteria

- `npm install` clean; `npm run build` green across all packages.
- `npm run typecheck` and `npm run lint` clean (300-line rule active).
- **Unit:** the sample neutral `*.test.ts` passes under `vitest run`.
- **Integration:** `auth.test.ts` green against `compose.test.yml` — 401
  `invalid_credentials` (non-enumerating), 429 `locked_out` with `retry_after_s`,
  session cookie set, `GET /auth/session` returns the seeded user.
- **e2e:** `health.spec.ts` green — browser → proxy → api → db round-trip renders.
- **`npm run check:schema` green** and fails on an injected drift (verify once).
- Pre-commit hook rejects an oversized/boundary-violating file (verify once).
- **Deploy:** `docker compose up -d --build` on Proxmox serves the app; health
  round-trip works on the deployed stack.
- **Restore drill:** documented `pg_dump`→`pg_restore` into a scratch DB succeeds.

## Size check

All `.ts/.tsx` ≤300 lines (middleware one file each; controllers thin). Exempt per
`modularity.md` §1: `schema.prisma`, generated client, `tokens.css`, migration SQL,
locale JSON, lockfiles.

## Checklist

- [ ] monorepo + workspaces + tsconfig + eslint/prettier + 300-line rule
- [ ] compose.yml / compose.test.yml / Caddyfile / .env.example
- [ ] Postgres up + first migration (unaccent/pg_trgm in SQL)
- [ ] auth skeleton (sessions, argon2id, CSRF, rate-limit/lockout, trusted proxy) + create-user
- [ ] health + auth/session route; SPA shell renders the round-trip; tokens.css verbatim
- [ ] unit + integration + e2e harness; Prisma↔DDL check; typecheck; lint; pre-commit; CI
- [ ] Windows-11 dev loop verified (db:dev / dev:api / dev:web)
- [ ] Proxmox deploy verified
- [ ] backup/restore drill proven
- acceptance: **end-to-end green + deploy + restore proven**
