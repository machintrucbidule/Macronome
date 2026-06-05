# Macronome — Architecture (phase 3a)

How the system is built. The **logical contract** (`spec/`, `DECISIONS.md`) and the
**visual contract** (`design/`) are FIXED; this architecture serves them and never
changes them. Where it would require a contract change, that is flagged, not done
silently.

This file is the high-level map. Details live in `docs/architecture/`:
`repo-structure.md`, `module-map.md`, `modularity.md`, `testing.md`, `ops.md`,
`security.md`, plus config appendices and per-package context files.

---

## 1. System topology

Macronome is **API-first**: the backend is the single source of business logic;
every client (the React SPA today, a React Native app later) is a thin consumer of
the same `/api/v1` contract.

```
   (operator's own        ┌──────────────────────────────────────┐
    proxy / TLS, optional) │  API + SPA  (one combined image)     │
   Browser ───────────────►│  · serves the static SPA build       │
   (React SPA)             │  · serves /api/v1 (Express 5)        │◄──┐
                           │  · domain + services + repositories  │   │ Prisma
                           └───────────────┬──────────────────────┘   │
                                           │              ┌────────────▼──┐
                                           └─────────────►│  PostgreSQL    │
                                                          │ (1 named vol.) │
                                                          │  unaccent,     │
                                                          │  pg_trgm       │
   (future) React Native ── same /api/v1 contract ───────►└────────────────┘

   one-shot:  ETL script (packages/etl) ── writes ──► PostgreSQL
```

**Deployment model — ADR-0001 (authoritative).** The app ships as a **single prebuilt
image on GHCR**: the Node/Express process serves **both** the static SPA and `/api/v1`
on one port (serving static files is **not** SSR — the SPA stays a pure same-origin
client). No reverse proxy ships in the stack; the operator fronts the exposed port with
their own proxy / TLS, or none. The API trusts forwarded client-IP headers **only from
the configured proxy** (`TRUSTED_PROXY`) so login rate-limiting sees the real client
regardless of frontal (see `security.md`). **Do not** reintroduce a build-from-source
compose or a bundled Caddy proxy — see `docs/architecture/decisions/0001-prebuilt-image-deployment.md`.

---

## 2. Finalised stack (one-line rationale each)

| Concern          | Choice                                                                                                | Rationale                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Repo layout      | **Monorepo, npm workspaces** (`api` · `web` · `shared`)                                               | Explicit module boundaries, one tree against context loss, RN-ready, single source for domain constants.       |
| Backend HTTP     | **Node + TypeScript, Express 5**                                                                      | Maximal agent reliability, minimal ceremony; structure comes from folders, not a framework.                    |
| Persistence      | **Prisma + Prisma Migrate** (PostgreSQL)                                                              | Best agent corpus + safest, reviewable migration workflow; extensions/trigram via raw SQL.                     |
| Validation       | **Zod**, schemas in `shared`                                                                          | One source for input validation **and** API DTO types, shared API↔client.                                      |
| Web build        | **Vite**                                                                                              | 2026 default; pairs with Vitest; keeps the SPA a pure API client (no SSR).                                     |
| i18n             | **i18next + react-i18next**                                                                           | Drop-in FR/EN files; number/date localisation via `Intl.*` (not i18next).                                      |
| Auth/session     | **Server-side opaque sessions in PostgreSQL** (`express-session` + `connect-pg-simple`), **argon2id** | Instantly revocable, no extra infra, clean CSRF model; not over-engineered (no JWT rotation).                  |
| Tests            | **Vitest** (unit + integration), **Playwright** (e2e), Postgres-in-compose                            | One runner front+back; reliable pass/fail = the agent's self-verification signal.                              |
| Packaging (prod) | **Docker Compose** (`macronome` · `postgres`), prebuilt GHCR image (ADR-0001)                         | Pull-and-run (Portainer-friendly); single combined image serves SPA + API; trivial standard `pg_dump` backups. |
| Dev              | **Windows 11 native** (npm) + Postgres in Docker Desktop                                              | Fast inner loop; full compose is prod-only.                                                                    |

Resolved internal point (left open by the contract): **day totals and
`verdict_auto` are computed on read**, not live-cached. `day_log.verdict_auto`
is still _persisted_ (written by the service on each day mutation, frozen via the
snapshot once `date < today`) purely so Stats scans stay index-friendly — the
source of truth is the computation. Avoids a whole class of cache-invalidation
bugs in a daily-use tool.

---

## 3. Request / data flow

A write (e.g. add a meal entry) travels one direction through fixed layers:

```
HTTP request
  → middleware:  trust-proxy → session/auth → CSRF → rate-limit → tenant context
  → route        (maps to one spec/api resource)
  → controller   (THIN: parse+validate with Zod → call service → serialize)
  → service      (orchestration: combine repositories + pure domain functions)
       ├── repository  (Prisma; EVERY query scoped by user_id)
       └── domain/*    (pure calculation; mirrors one spec/logic area)
  → response     (JSON per spec/api; full-precision numbers, client rounds)
```

Three invariants, enforced structurally:

1. **Business logic is the backend's.** Clients render; they never recompute a
   verdict, burn, proration, EMA, etc. The SPA reads computed values from the API.
2. **`user_id` scoping is in the repository layer.** Controllers/services cannot
   issue an unscoped query; cross-tenant access returns 404 (no existence leak).
3. **History is frozen by snapshots, not by logic.** `meal_entry` macro
   snapshots, `day_log.target_snapshot`, and the `leftover_group` frozen container
   value (`container_name` + `tare_g`) make past data immutable to later edits —
   the schema already encodes this; services must respect it.

A read (e.g. `GET /days/:date`) runs the same layers minus CSRF; derived figures
(totals, constat, periods, stats) are produced by `domain/*` functions over the
rows the repository returns.

---

## 4. Where the future React Native client plugs in

RN is **not built in v1**. It is enabled, not anticipated with code:

- It consumes the identical `/api/v1` contract — zero logic to reimplement.
- It reuses `packages/shared` (DTO Zod schemas/types + domain constants).
- It is added as `packages/mobile` alongside `web`; nothing in `api`/`shared`
  changes. The auth model (cookie sessions) is the one area RN will adapt
  (mobile token/cookie handling) — noted, not designed, in v1.

---

## 5. What this architecture deliberately does NOT do (anti-over-engineering)

- No Redis/cache layer, no message queue, no microservices — single API + single
  DB fits one self-hosted user with years of data.
- No JWT/refresh-token machinery — server sessions are simpler and safer here.
- No PITR/WAL archiving baked into the app — standard `pg_dump`/restore is
  complete (all critical state is in one Postgres volume). Schedule/retention are
  the operator's, out of scope.
- No SSR framework — the contract wants an API-first SPA; SSR would blur that line.
- No monorepo task runner (Turborepo/Nx) for three packages — npm workspaces suffice.
