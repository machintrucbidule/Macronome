# O1 — Excel migration (Excel → DB) — **NOT part of the dev plan**

> **This is NOT a development milestone.** It does **not** carry an `M` number, it is
> **not** a build gate, and it is **not** required for v1. It is the one-shot import of
> the author's personal Excel workbook into the DB, **run on the author's decision
> only**, once the application is judged mature / bug-free. It is documented here so the
> information is ready when the author chooses to run it. The dev plan ends at M9; the
> app is fully usable before this step (the first user is created by M8's first-run
> wizard, **not** by this import).

**Goal:** the one-shot Excel→DB migration. Built/run **late, on purpose** — against a
stable schema so it never chases moving tables. Validation is **local-only** and the run
is **re-runnable**. Depends-on: a stable schema (post-M8 feature set).

## Why out of the dev plan

The ETL is the bridge from the years-old workbook to the new DB; if the schema is still
moving, the ETL rots. More importantly, the author wants to import real data only when
the app is mature — so this work is deliberately kept out of the build sequence and run
on demand. It targets final tables once.

## Scope (`spec/logic/migration-etl.md` — fixed contract, unchanged)

- Standalone `packages/etl` (not in API runtime), reusing `shared` constants + the
  Prisma layer. Entry `src/run.ts` (reads xlsx path → writes DB), `extract/`,
  `transform/`, `load/`, `report/` (manual-review emitter).
- All imported history → **summary** days (read-only, calorie + verdict + comment);
  **no detailed day imported** (Gap 3). Import only genuinely filled days up to today;
  skip future/projected/empty rows.
- (nb)/(poids) merge by base-name key: clean pair → one food (per-100 g from (poids);
  portion grams = `kcal(nb)/kcal(poids)`); embedded-gram suffix is a cross-check only;
  "(nb)"-only and ambiguous → **manual-review list, no silent auto-merge**;
  "(poids)"-only handled per spec. Rating map `Top/Ok/Moyen/Bof/(N-A,blank)→3/2/1/0/null`.
- Recipes unify (`Recettes` + `Recettes calcul`) → one Recipe + derived food.
- Weight history → weigh-ins with **exact dates preserved** (variable periods);
  containers from `Poids à vide`; per-period activity seeds days where available.

## Files (via `module-map.md`)

`packages/etl/src/{run.ts, extract/*, transform/*, load/*, report/*}`,
`packages/etl/fixtures/sample.xlsx` (**neutral, trimmed**, git-synced).
Transforms mirror `spec/logic/migration-etl.md`. Real-workbook validation:
`*.local.test.ts` reading `specifications/suivi_poids.xlsx` and
`specifications/tests-local/*` — **git-ignored, never CI**.

## Acceptance criteria

- **Unit (neutral, synced)** `etl/src/**/*.test.ts`: nb/poids merge oracle
  (`Item A: 3500/100=35g`, `Item B: 4350/100=43.5g` — ratio is truth); rating map;
  summary-day mapping; weight-history dates preserved. Run in CI against the neutral
  fixture.
- **e2e (neutral, synced)** `etl/test/run.test.ts` against `compose.test.yml` + the
  trimmed `sample.xlsx`: assert food/recipe/summary-day/weigh-in counts and the
  manual-review list (`name|reason|suggested_action`); assert **no ambiguous pair
  auto-merged**.
- **Local-only validation** `etl/test/run.local.test.ts`: run against the real
  `specifications/suivi_poids.xlsx`; assert the real row inventory/counts and a clean
  manual-review list. Git-ignored; not in CI.
- **Re-runnable:** a second run is idempotent / clearly reports what it would change
  (no duplicate import); verified once locally.
- **UI smoke (e2e):** imported summary days render **read-only**.

## Size check

`extract/transform/load/report` split into small modules per concern; no single
transform file approaches 300 lines.

## Checklist (executed only when the author triggers O1)

- [ ] etl package wired (reuses shared + Prisma); run.ts CLI
- [ ] extract/transform/load/report modules per spec
- [ ] neutral unit tests (merge ratio, rating map, summary map, dates) — CI
- [ ] neutral e2e against sample.xlsx (counts + manual-review, no auto-merge) — CI
- [ ] local-only run.local.test.ts against the real workbook — git-ignored
- [ ] re-runnable verified; summary days read-only in UI
- acceptance: neutral ETL unit+e2e green in CI; local-only real-workbook validation green locally
