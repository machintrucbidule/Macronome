# CLAUDE.md — Macronome (agent entry point)

Read this first. It tells you how to run, test, and build the project, where
everything lives, the rules you must not break, and the workflow for any change.

Macronome is a self-hosted, internet-facing nutrition & weight tracker that replaces
a daily-use Excel workbook. **It must match or exceed that workbook from v1.**

---

## Fixed contracts — never edit these

These are inputs you implement against, not files you change. They split across two
locations:

**Git-synced contracts** (pushed; the neutralised, shareable authority):

- `spec/` — logical contract: data schema (`spec/schema/`), API (`spec/api/`),
  domain logic with **neutral** worked numeric examples (`spec/logic/`).
- `design/` — visual contract: `tokens.css` (copied verbatim into the web app),
  `components/*.md`, `theming.md`, `NORMALIZATION_LOG.md`.
- `DECISIONS.md` — resolved gap decisions (personal specifics neutralised).

**Git-ignored local authority** (under `specifications/`, never pushed; may contain
personal data):

- `specifications/screens/*.md`, `specifications/mockups/*.html`,
  `specifications/masterplan.md`, `specifications/RECONCILIATION_LOG.md`,
  `specifications/OPEN_GAPS.md`, `specifications/suivi_poids.xlsx`,
  `specifications/tests-local/` (real-value oracle data + migration fixtures).

If the code seems to require a contract change, **stop and flag it** — do not edit
the contract to fit the code.

> **`spec/`, `design/`, `DECISIONS.md` are git-synced**; **`specifications/` is
> git-ignored** (personal data). A fresh clone has the synced contracts but **not**
> `specifications/`. If a task needs a `specifications/` artifact (a screen spec, a
> mockup, the workbook, real-value oracles) and it is missing, **stop and ask for the
> corpus** rather than guessing — do not reconstruct contract facts from memory.
> Provenance back-references in `spec/logic/*` and `DECISIONS.md` to
> `RECONCILIATION_LOG.md` / `OPEN_GAPS.md` point into that git-ignored tree.
> All paths in the docs are relative to the repo root (`Macronome/`).

Architecture docs (how it's built) are in `ARCHITECTURE.md` + `docs/architecture/`.

---

## Layout (where things go)

- `packages/shared` — DTO Zod schemas + types, and domain **constants** (energy
  9/4/4, 7700 kcal/kg, activity multipliers, rating scale, tuning constants). No logic.
- `packages/api` — Express + Prisma. The **only** place business logic lives:
  `domain/*` (pure calculations, one folder per `spec/logic` area), `services/*`
  (orchestration), `data/repositories/*` (Prisma, always user-scoped), `http/*`.
- `packages/web` — React + Vite SPA. **Renders, never computes.** One folder per
  screen under `features/`, design components under `components/`.
- `packages/etl` — one-shot Excel → DB migration script. **Built in O1, which is _out
  of the dev plan_** (run on the author's decision; see `docs/dev-plan/O1-excel-migration.md`).

The precise mapping (logic spec → module, screen → feature, component → file) is in
`docs/architecture/module-map.md`. Use it to locate where a change belongs.

---

## Commands

Run from the repo root.

| Task                     | Command                                            |
| ------------------------ | -------------------------------------------------- |
| Install                  | `npm install`                                      |
| Generate Prisma client   | `npm run prisma:generate -w @macronome/api`        |
| Start test/dev DB        | `npm run db:dev` (Postgres via `compose.test.yml`) |
| Dev API                  | `npm run dev:api`                                  |
| Dev web                  | `npm run dev:web` (Vite proxies `/api` to the API) |
| Typecheck                | `npm run typecheck`                                |
| Lint                     | `npm run lint`                                     |
| Unit + integration tests | `npm test` (and `npm run test:int`)                |
| E2E                      | `npm run e2e`                                      |
| Build all                | `npm run build`                                    |
| DB migrate (prod)        | `npm run migrate`                                  |

> **Generate the Prisma client before lint/typecheck.** The type-aware ESLint rules
> and `tsc` need the generated client; without it `@prisma/client` is `any` and lint
> fails (this is what bit CI). A fresh clone has no client until you generate it — run
> the command above (or `npm run build`). CI and the Dockerfile generate it after
> install; do not remove those steps. There is **no `postinstall` generate** on purpose
> (it would break the Docker `deps`/`--omit=dev` stages where the schema/CLI are absent).

Create a migration: `npm run prisma:dev -w @macronome/api -- --name <change>`
(after editing `packages/api/prisma/schema.prisma` to match `spec/schema/*`).

First user (no open/public sign-up): on a fresh install the **first-run setup wizard**
creates the single owner account (`POST /auth/setup`, gated to zero users, then
disabled — built in M8). The `create-user` script in `packages/api` (argon2id hash)
remains an admin fallback. See `docs/architecture/ops.md` §7.

---

## Rules you must not break

1. **File size: hard max 300 lines** per `.ts`/`.tsx` (ESLint errors above). Split
   before you exceed it. One responsibility per file. See `docs/architecture/modularity.md`.
2. **Logic lives in the backend.** The web app must not compute verdicts, burns,
   proration, totals, EMA, BMI, etc. — it reads them from the API. `web` imports
   `shared` constants only for labels/formatting, never to compute a nutrition figure.
3. **Tenant scoping in the repository layer.** Every repository method takes the
   authenticated `userId`. Never write an unscoped query. Cross-tenant → 404.
4. **History is frozen by snapshots.** Respect `meal_entry` macro snapshots,
   `day_log.target_snapshot`, and the `leftover_group` frozen container value. Editing
   a food/recipe/target/weigh-in must never alter past days that are already frozen.
5. **Validate at the controller with Zod** (from `shared/dto`) before any service runs.
6. **Use semantic tokens**, never raw hex, in `web` styles. Theme = `data-theme` on `<html>`.
7. **SI units only.** Grams internally; display rounding per `spec/logic/00-conventions.md`.

---

## Naming conventions

- Files: components `PascalCase.tsx`; hooks `useThing.ts`; everything else
  `kebab-case.ts`. Tests `*.test.ts(x)` co-located (domain) or under `test/` (integration).
- Identifiers: `camelCase` (TS), `PascalCase` (types/components/Zod schemas as
  `FoodSchema`), `UPPER_SNAKE` (constants). DB identifiers stay `snake_case` (schema contract).
- API error codes: `string_snake`, matching `spec/api/00-conventions.md` and `shared/errors.ts`.

---

## Standard change workflow

1. **Locate** the right module via `docs/architecture/module-map.md`.
2. **Implement** in the correct layer (controller → service → repository | domain).
   Keep files small; extract early.
3. **For a calculation**: wire the worked example(s) from the relevant `spec/logic`
   file as the unit-test oracle(s) first, then make them pass.
4. **Run** the relevant tests + `npm run typecheck` + `npm run lint` (generate the
   Prisma client first — see Commands). `verify.bat` runs the whole gate on Windows.
5. **Done** = relevant test layer green + typecheck + lint clean **and CI green**.
6. **Update `DEV_PLAN.md`** (the living checklist) — tick what you completed.
7. **Commit and push to `main`.** Then confirm the CI run is green (`gh run watch`);
   if it fails, fix forward in the same flow.

Per-package notes: `packages/api/CLAUDE.md`, `packages/web/CLAUDE.md`,
`packages/shared/CLAUDE.md` (provided in `docs/architecture/context-files/` until
the repo is scaffolded in milestone 3b).

---

## Git & CI

- **Push directly to `main`.** This is a single-developer project — **no feature
  branches, no PRs**. Commit per logical change, verify locally, push `main`. (This
  overrides the generic "branch off the default branch" habit.)
- **CI must stay green.** `.github/workflows/ci.yml` runs on every push: it does
  `npm ci`, **generates the Prisma client**, then lint → typecheck → check:schema →
  unit → migrate → integration (and e2e on PRs to `main`). A green local run that
  skips `prisma generate` is **not** proof CI passes — the client must be generated
  (CI is the "fresh clone" context). After pushing, check the run with `gh run watch`.
- **Never commit personal/local files** (`.env`, `specifications/`, `*.local.test.ts`,
  DB dumps). Confirm `git status` before each commit.
