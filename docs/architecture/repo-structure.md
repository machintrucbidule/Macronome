# Repository & module structure

Monorepo, **npm workspaces**, three packages (+ a one-shot ETL package). One Git
repo on GitHub. The mapping from contract artifacts to code locations is in
`module-map.md`; this file shows the tree and the boundaries.

Boundary rule the agent relies on: **every piece of code has exactly one obvious
home.** A calculation → `api/src/domain/<area>`. A screen → `web/src/features/<screen>`.
A design component → `web/src/components/<Component>`. A shared constant or DTO →
`packages/shared`.

---

## Top level

```
Macronome/                       # repo root (git-synced)
├─ README.md                 # orientation
├─ CLAUDE.md                 # agent entry point (root)
├─ ARCHITECTURE.md           # + docs/architecture/*
├─ DEV_PLAN.md               # living build checklist — kept by the agent
├─ SETUP.md                  # Windows-11 environment readiness (pre-M0)
├─ DECISIONS.md              # resolved gap decisions (personal specifics neutralised)
├─ docs/architecture/        # the rest of the architecture docs (this folder)
├─ spec/                     # ★ SYNCED logical contract: README + schema/ + api/ + logic/
│                            #   (logic/ worked examples are NEUTRAL CI oracles)
├─ design/                   # ★ SYNCED visual contract: tokens.css, tokens.md, theming.md,
│                            #   NORMALIZATION_LOG.md, components/
├─ .gitignore                # ignores specifications/, *.local.test.ts, .env, node_modules, dist, *.dump
├─ package.json              # workspaces: ["packages/*"]; root scripts only   (created M0)
├─ tsconfig.base.json        # shared compiler options; each package extends it (created M0)
├─ eslint.config.js          # flat config incl. the file-size rule              (created M0)
├─ .prettierrc                                                                  # (created M0)
├─ .env.example              # versioned template (no secrets)                  (created M0)
├─ compose.yml               # prod: macronome (image, serves SPA+API) + postgres (ADR-0001)
├─ compose.test.yml          # test Postgres only                              (created M0)
├─ e2e/                      # Playwright specs (drive the running stack)       (created M0+)
├─ packages/                 # created by milestone M0 — not scaffolded yet
│  ├─ shared/
│  ├─ api/
│  ├─ web/
│  └─ etl/                   # one-shot Excel → DB migration script
└─ specifications/           # ★ GIT-IGNORED — personal/provenance authority, may hold
                             #   personal data. Present locally, never pushed.
   ├─ masterplan.md  OPEN_GAPS.md  RECONCILIATION_LOG.md  suivi_poids.xlsx
   ├─ screens/      (the 11 screen specs)
   ├─ mockups/      (the 11 HTML mockups)
   └─ tests-local/  (real-value oracle data + migration fixtures; feeds *.local.test.ts)
```

> **Two-tier contract.** The shareable, neutralised contracts (`spec/`, `design/`,
> `DECISIONS.md`) are **git-synced** and present in any clone. The personal/provenance
> authority (`specifications/`) is **git-ignored** — a fresh clone will not contain it;
> the agent must be given that corpus locally. `spec/logic/*` ships **neutral** CI
> oracles; real-value validation lives in the git-ignored `*.local.test.ts` suites
> (see `testing.md`). Everything outside `specifications/` (and not `.env`,
> `node_modules`, `dist`, dumps, `*.local.test.ts`) is git-synced.

---

## packages/shared (types + constants ONLY — no runtime logic)

```
packages/shared/
├─ package.json              # name: @macronome/shared
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ constants/
   │  ├─ energy.ts           # KCAL_PER_G = {fat:9,carb:4,protein:4}; KCAL_PER_KG = 7700
   │  ├─ activity.ts         # 5 levels: key, multiplier, i18n keys (1.2 … 1.9)
   │  ├─ rating.ts           # null=unrated, 0..3; helpers (isRated, ratingFilter)
   │  └─ tuning.ts           # EMA_ALPHA=0.35, BEST_MONTH_MIN_DAYS=5,
   │                         #   NOK_RUN_ALERT=3, SUGGEST_HALF_WIDTH=50
   ├─ dto/                   # ONE Zod schema module per API resource → inferred types
   │  ├─ auth.ts  food.ts  recipe.ts  container.ts
   │  ├─ day.ts   weight.ts  target.ts  stats.ts  settings.ts
   │  └─ common.ts           # pagination, error envelope, list params
   └─ errors.ts              # ErrorCode enum mirroring spec/api/00-conventions.md
```

`shared` holds **no calculation functions** — the backend owns logic (§ ARCHITECTURE).
It holds the magic numbers the oracles depend on, written once, imported by `api`
(compute) and `web` (display), so they cannot drift.

---

## packages/api (Express + Prisma; the only place logic lives)

```
packages/api/
├─ package.json              # name: @macronome/api
├─ tsconfig.json
├─ prisma/
│  ├─ schema.prisma          # faithful to spec/schema/* (2nd source kept in sync)
│  └─ migrations/            # reviewable SQL; extensions + GIN trigram live here
├─ data/                     # committed reference extracts (Ciqual), read by the
│                            #   boot seeder; copied into the runtime image as-is
├─ scripts/                  # tsx-run maintenance scripts (create-user, seed builder)
└─ src/
   ├─ server.ts              # bootstrap (listen)
   ├─ app.ts                 # express app: middleware order, route mount
   ├─ config/
   │  └─ env.ts              # Zod-validated env (DATABASE_URL, SESSION_SECRET, …)
   ├─ http/
   │  ├─ middleware/         # trustProxy, session, auth, csrf, rateLimit, tenant,
   │  │                      #   errorHandler  (one file each)
   │  ├─ routes/             # ONE module per spec/api resource (mounts controllers)
   │  └─ controllers/        # THIN: Zod parse → service → serialize
   ├─ services/              # orchestration; ONE per resource area
   ├─ data/
   │  ├─ prisma.ts           # single PrismaClient
   │  └─ repositories/       # ONE per aggregate; EVERY method takes userId
   │                         #   (exception: food-ref.repo — global Ciqual reference
   │                         #    data, read-only, no tenant; see security.md §6)
   ├─ domain/                # PURE calculations — ONE folder per spec/logic area
   │  ├─ metabolic/  targets/  day-verdict/  leftover/
   │  ├─ recipes/    weight/   stats/   ciqual/
   │  └─ search/             # normalize() for unaccent parity (display side)
   └─ i18n/                  # server returns error CODES; minimal strings only
```

Layer contract: **controller → service → (repository | domain)**. Controllers never
touch Prisma; services never embed SQL; domain functions never touch I/O. This keeps
each domain area unit-testable against its spec oracle in isolation.

---

## packages/web (React + Vite SPA — renders, never computes)

```
packages/web/
├─ package.json              # name: @macronome/web
├─ tsconfig.json   vite.config.ts
├─ index.html
└─ src/
   ├─ main.tsx               # mount + providers (theme, i18n, query client, router)
   ├─ app/
   │  ├─ router.tsx          # routes → features
   │  ├─ providers/          # ThemeProvider, I18nProvider, QueryProvider
   │  └─ AppShell.tsx        # appbar + nav + account menu frame
   ├─ styles/
   │  ├─ tokens.css          # COPIED VERBATIM from design/tokens.css (do not edit)
   │  └─ global.css
   ├─ i18n/
   │  ├─ config.ts
   │  └─ locales/ fr.json  en.json
   ├─ api/                   # typed client; ONE module per resource (uses shared DTOs)
   ├─ lib/                   # intl.ts (Intl number/date), hooks, small utils
   ├─ components/            # design-system components — ONE per design/components/*
   └─ features/              # ONE folder per screen (the 11 screens)
```

The `meals` feature decomposition (the 763-line mockup → many files) is the
worked example of the file-size discipline — see `modularity.md`.

---

## packages/etl (one-shot Excel → DB; not in the API runtime)

```
packages/etl/
├─ package.json              # name: @macronome/etl
├─ src/
│  ├─ run.ts                 # CLI entry (reads xlsx path, writes DB)
│  ├─ extract/               # sheet readers (Archive cal, Suivi, foods, recipes, tares)
│  ├─ transform/             # nb/poids merge, ratings, summary-day mapping, weight
│  ├─ load/                  # uses the same Prisma client / repositories
│  └─ report/                # manual-review list emitter (name|reason|action)
└─ fixtures/                 # a trimmed sample workbook for tests
```

Kept separate so the run-once migration never enlarges the API's surface, while
reusing `shared` constants and the Prisma layer. Its logic mirrors
`spec/logic/migration-etl.md` and is test-covered (see `testing.md`).
