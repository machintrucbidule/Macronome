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
     extension/trigram SQL. Wired into CI and the _done_ rule.
   - `npm run typecheck`, `npm run lint`, **pre-commit** (husky + lint-staged: eslint
     - prettier + `tsc --noEmit` on changed files).
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

- [x] monorepo + workspaces + tsconfig + eslint/prettier + 300-line rule
- [x] compose.yml / compose.test.yml / Caddyfile / .env.example (+ api Dockerfile)
- [x] Postgres up + first migration (unaccent/pg_trgm + session table in SQL)
- [x] auth skeleton (sessions, argon2id, CSRF, rate-limit/lockout, trusted proxy) + create-user
- [x] health + auth/session route; SPA shell renders the round-trip; tokens.css verbatim
- [x] unit + integration + e2e harness; Prisma↔DDL check; typecheck; lint; pre-commit; CI
- [x] Windows-11 dev loop verified (db:dev / dev:api / dev:web — proven via the e2e webServer round-trip)
- [~] ~~Proxmox deploy verified~~ → **deferred to production setup** (local-only this
  session, per user decision). The Docker config to import into Portainer is delivered
  (`compose.yml`, `Caddyfile`, `packages/api/Dockerfile`, `.env.example`); the deploy
  is executed at go-live, not specific to Proxmox.
- [~] ~~backup/restore drill proven~~ → **deferred to production setup** (run the
  documented `pg_dump`→`pg_restore` once against the live DB at go-live; ops.md §6).
- acceptance: **local end-to-end green** (build + typecheck + lint + unit + integration + e2e + check:schema + pre-commit gate). Deploy + restore drill deferred as above.

## M0 implementation notes (decisions taken during the build)

- **Monorepo resolution:** `@macronome/shared` is aliased to source for dev (tsconfig
  `paths` for tsx/typecheck, Vite alias for web) so dev needs no prebuild; prod resolves
  the built `dist` via package `main`. A single `vite` is pinned via root `overrides`.
- **Typecheck** uses `tsc -b` (not `tsc -b --noEmit`, which TS rejects with composite
  references — TS6310); emit lands in gitignored `dist`/`.tsbuild`.
- **ESLint** is flat + type-aware (`projectService`); the 300-line cap and layer
  import-boundaries (web↛api, domain↛data/http/Prisma, controllers↛Prisma) are enforced.
- **check:schema** parses the `spec/schema/*.md` tables vs `schema.prisma` and fails on
  drift for implemented tables (verified once with an injected column). The
  connect-pg-simple `session` table is whitelisted (infra, not in the DDL contract).
- **Auth:** server sessions in Postgres (`connect-pg-simple`), argon2id (with a dummy
  hash on the unknown-user path for non-enumerating, uniform-timing 401), double-submit
  CSRF, login lockout keyed on (username, real client IP) → 429 with `retry_after_s`.
