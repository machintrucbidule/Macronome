# CLAUDE.md — packages/api

Express 5 + Prisma. **The only place business logic lives.** Renders nothing.

## Layers (strict, top → bottom; never skip or invert)

- `http/routes/*` — one module per `spec/api` resource; mounts controllers.
- `http/controllers/*` — THIN: Zod-parse the request (schemas from `@macronome/shared`)
  → call a service → serialize the response. No maths, no SQL.
- `services/*` — orchestration: fetch via repositories, call `domain/*`, persist.
- `data/repositories/*` — Prisma only. **Every method takes `userId` and scopes by it.**
  One documented exception: a global reference table with no user data (`food-ref.repo`,
  the Ciqual catalog) is read-only and takes no `userId` — see `security.md` §6.
- `domain/*` — PURE functions, one folder per `spec/logic` area. No I/O, no Prisma,
  no request objects. Inputs in, outputs out. Co-located `*.test.ts` with the spec oracles.

ESLint enforces these boundaries (domain can't import data/http/Prisma; controllers
can't import Prisma). Don't fight the rule — it's the architecture.

## Persistence

- `prisma/schema.prisma` is kept faithful to `spec/schema/*`. When they'd diverge,
  the contract wins — flag it.
- PG extensions (`unaccent`, `pg_trgm`) and GIN trigram indexes live in **migration
  SQL**, not in `schema.prisma`.
- `numeric` columns: convert to JS number at the repository boundary; compute in
  float64; the oracles compare at display precision.

## Auth & security (see docs/architecture/security.md)

- Server-side sessions (`express-session` + `connect-pg-simple`), argon2id hashing.
- CSRF token on state-changing routes; cookie HttpOnly/Secure/SameSite=Lax.
- Login lockout keyed on real client IP (trusted proxy only).
- Non-enumerating errors: 401 `invalid_credentials`, 429 `locked_out`.
- In prod the API also **serves the built SPA** (`http/spa.ts`, gated on `WEB_DIST`) and
  emits its own security headers (`http/middleware/securityHeaders.ts`) — ADR-0001.

## Tests

- Unit: `src/domain/<area>/<area>.test.ts`, oracles from `spec/logic/*`.
- Integration: `test/integration/<resource>.test.ts` against `compose.test.yml`.
- Run: `npm test -w @macronome/api`.

## Don'ts

- Don't cache day totals/verdicts live; compute on read (verdict_auto is persisted
  only as an index-friendly mirror, written by the service).
- Don't put a 15-table god-repository; one repository per aggregate (day.repo owns
  day_log→meal→meal_entry→leftover_group).
