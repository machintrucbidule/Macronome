# Testing strategy

Tests are the mechanism by which **Claude Code verifies its own work**. "Done" for
any change = the relevant test layer is green, plus typecheck and lint. The detailed
acceptance roadmap is phase 3b; this defines the layers, frameworks, locations, and
the self-verification rule.

Frameworks: **Vitest** (unit + integration), **Playwright** (e2e), **Postgres in
docker-compose** (`compose.test.yml`) for anything touching the DB.

Numeric assertions compare at **display precision** from `spec/logic/00-conventions.md`
(kcal integer; macros/weight/EMA/BMI 1 decimal; ratios & kg/week 2 decimals), unless
a spec example says "exact". Internal compute is float64.

---

## 1. Layer: unit — the domain calculations (highest value)

Pure functions in `api/src/domain/*` (and `etl/src/transform/*`). **Every worked
example in `spec/logic/*` is wired as a named test case** referencing its source, so
the spec is the oracle and traceability is explicit. Those spec examples are
**neutral** (e.g. profile 80 kg / 180 cm / 40 / male → BMR 1730) and ship git-synced,
so CI self-verifies the logic without any personal data.

Real-value validation (the author's actual numbers) lives **only** in git-ignored
`*.local.test.ts` suites that read the corpus under `specifications/tests-local/`;
those are never pushed and never run in CI. Never copy a real value into a synced
`*.test.ts`.

Location: co-located, `api/src/domain/<area>/<area>.test.ts` (synced, neutral);
real-value mirror `api/src/domain/<area>/<area>.local.test.ts` (git-ignored).

Pattern:

```ts
// api/src/domain/metabolic/metabolic.test.ts  (SYNCED — neutral oracle)
import { bmr, empiricalBurnPerDay } from './metabolic';

// Oracle values are the NEUTRAL worked examples from the synced spec.
// Source: spec/logic/metabolic-engine.md §2 / §4.
test('BMR Mifflin-St Jeor (neutral oracle)', () => {
  // spec §2: 10*80 + 6.25*180 − 5*40 + 5
  expect(bmr({ weightKg: 80, heightCm: 180, age: 40, sex: 'male' }))
    .toBeCloseTo(1730, 1);              // display precision: 1 dp
});

test('empirical burn/day = avgIntake + lostKg*7700/days (neutral oracle)', () => {
  // spec §4: 2000 + 0.5*7700/7
  expect(empiricalBurnPerDay({ avgIntake: 2000, weightStart: 80, weightEnd: 79.5, days: 7 }))
    .toBe(2550);
});
```

Minimum oracle coverage that must exist (one test per worked example in the spec,
plus its edge cases) — the numbers come from the **neutral** examples in `spec/logic/*`:
- metabolic: BMR ×2, estimated burn, recent-avg burn, empirical burn, deficit, deficit-at-target.
- targets: floors + carb ceiling, **carb ceiling ≤ 0 (negative, not clamped, no throw)**, suggest range.
- day-verdict: OK / NOK-DÉPASSÉ / NOK-SOUS; snapshot resolution by date; effective verdict.
- leftover: the canonical plate (consumed scales by consumed/served), both block cases (`gross < tare`, `net > served`), re-edit recompute.
- recipes: per-100 g + per-portion; batch-weight change keeps per-portion macros; **transitive cycle rejected**.
- weight: EMA chain over the weigh-in series, broken-line trajectory (anchor + in/not-in diet + goal cap), BMI, projection, single/empty weigh-in.
- stats: rolling 7 (average + OK rate with gaps excluded), streak across gaps, best month ≥5-day rule.

---

## 2. Layer: integration — the API contract

Hit the real Express app against a real Postgres (migrated + `unaccent`/`pg_trgm`).
Assert response shape, status codes, and **error codes** exactly as
`spec/api/*` defines them.

Location: `api/test/integration/<resource>.test.ts`. A per-suite transaction or
truncate-between-tests keeps cases isolated; a seeded test user provides the tenant.

Must-cover contract points (not exhaustive):
- auth: 401 `invalid_credentials` (non-enumerating), 429 `locked_out` with `retry_after_s`, session cookie set, `GET /auth/session`.
- tenancy: another user's resource → **404** (not 403).
- leftover: 409 `gross_below_tare`, 409 `leftover_exceeds_served`, **nothing written on block**.
- targets: carb ceiling ≤ 0 → **200 + `warnings:['carb_ceiling_non_positive']`**, save succeeds.
- weight: 409 `weigh_in_date_occupied` with `existing_id`; date edit re-derives periods.
- foods: duplicate active name → 201 + `warnings:['duplicate_name']` (non-blocking); archive removes from search.
- recipes: 422 `would_create_cycle`; save (re)builds the derived food + auto "portion".
- validation: malformed body → 422 with per-field `details`.
- reserved: `POST /advisor/query` → 501 `not_implemented`.

---

## 3. Layer: e2e — the critical flows

Playwright drives the SPA against the running stack. Scope = the flows the brief
names (the ones whose breakage hurts most):

Location: `e2e/`.
- **Daily log entry** — open today, add a referenced line (qty + unit/portion), see totals + verdict update.
- **Leftover proration** — multi-select a plate, enter gross + container, preview, apply; consumed scales; then the block case shows a warning and writes nothing.
- **Weight / period** — add weigh-ins, see EMA + broken-line trajectory + a derived period; edit a date and watch periods re-derive.
- **Migration** — runs in the ETL suite (below), with a UI smoke check that imported summary days are read-only.

---

## 4. ETL tests (the one-shot migration)

The migration is run-once but **must be tested**, because it is the bridge from the
years-old workbook to the new DB.

Location: `etl/src/**/*.test.ts` (unit transforms) + `etl/test/run.test.ts`
(end-to-end against `compose.test.yml` and a trimmed sample workbook in
`etl/fixtures/`).
- unit: nb/poids merge oracles (portion grams = `kcal(nb) / kcal(poids)`, verified against the embedded `(nb/Ng)` suffix where present — exact items in `spec/logic/migration-etl.md` §3); rating map (`Top/Ok/Moyen/Bof/(N-A,blank)` → `3/2/1/0/null`); summary-day mapping; weight-history dates preserved.
- e2e: import the fixture, assert food/recipe/summary-day/weigh-in counts and the manual-review list (`name|reason|suggested_action`); assert **no ambiguous pair auto-merged**.

---

## 5. Schema alignment check — Prisma ↔ DDL contract

`spec/schema/*` is the **DDL contract** (authoritative table/column/index
definitions). `packages/api/prisma/schema.prisma` is a faithful second copy the
runtime uses. They must not silently drift. An automated check enforces this:

- A script (`npm run check:schema`, set up in **M0**) compares the live Prisma schema
  against the DDL contract and **fails (non-zero exit)** on any divergence:
  missing/extra tables or columns, type or nullability mismatches, or missing
  contract indexes/unique constraints. PG-only artifacts that legitimately live in
  migration SQL (the `unaccent`/`pg_trgm` extensions and the GIN trigram indexes) are
  whitelisted so they don't register as false drift.
- Implementation is the agent's (M0): introspect the migrated test DB (or parse
  `schema.prisma`) and diff against the parsed `spec/schema/*` tables/indexes. The
  point is a hard pass/fail signal, not the diff format.
- It runs in **CI on every push** alongside lint/typecheck, and is part of the
  *done* rule below: a change that edits the schema is not done until `check:schema`
  is green. When the two disagree, **the contract wins** — fix `schema.prisma`, never
  the contract (`CLAUDE.md` → *Fixed contracts*).

---

## 6. "Done" — the self-verification rule

For any change the agent makes, *done* means all of:
1. the **relevant** layer is green (unit for a calc, integration for an endpoint, e2e for a flow);
2. if the change touches the schema, `npm run check:schema` (Prisma ↔ DDL, §5) is green;
3. `tsc --noEmit` passes;
4. eslint passes (incl. the 300-line rule).

Frontend component tests (Vitest + React Testing Library) are **available but not
mandated** — used only for components with tricky local logic (keyboard nav, font
autosize). The weight stays on domain-unit + API-integration + e2e-flow.

CI: GitHub Actions runs lint + typecheck + the Prisma↔DDL check (§5) + unit +
integration on every push, e2e on PRs to the main branch (pipeline details are ops).
**Only the neutral `*.test.ts` oracles run in CI**; `*.local.test.ts` (real-value &
migration validation) are git-ignored and run locally only. Coverage is reported, not
gated, in v1 — the oracle suite matters more than a percentage.
