# M3 — Daily log (meals, entries, leftover)

**Goal:** the core daily loop — lazily-created day, meals/entries, the OK/NOK verdict
with snapshot freezing, leftover proration, and the per-day activity constat.
Depends-on: M1 (foods to log), M2 (target snapshot + burns).

## Scope

- Day aggregate tables (`spec/schema/tables-logging.md`): `day_log` (+ `kind`
  summary|detailed, `target_snapshot`, persisted `verdict_auto`, `verdict_override`,
  `activity_level`), `meal`, `meal_entry` (served qty + macro snapshot),
  `leftover_group` (+ frozen `container_name`/`tare_g`/`gross_grams`) and
  `leftover_group_entry`. `day.repo` owns the whole aggregate (`module-map.md` §4).
- Snapshot & verdict (`spec/logic/day-snapshot-verdict.md`): lazy DayLog creation;
  snapshot resolved from **that date's** effective target + weight; **live while
  date==today, frozen once date<today**; calorie-only auto verdict + override;
  effective verdict.
- Leftover proration (`spec/logic/leftover-proration.md`): net = gross − tare;
  **block + warn (write nothing)** on `gross<tare` or `net>served_total`; prorate by
  served share; macros scale by consumed/served; re-editable (consumed derived).
- Per-day activity constat (`metabolic-engine.md`): burn = BMR(weight on day) ×
  activity; deficit = day_kcal − burn; shown beside the verdict, not stored.
- Repas screen (`specifications/screens/meals.md`, `meals.html`) — the largest mockup;
  decompose per `modularity.md` §2 (page + DayHeader/TotalsRow/MealColumn/FoodLine/
  InlineFoodSearch + the three feature-local modals). Journal screen
  (`history.md`) read view + pill.

## Files (via `module-map.md`)

API: `domain/day-verdict/` (+ test), `domain/leftover/` (+ test),
`services/{days,meals,entries,leftover,journal}.ts`, `data/repositories/day.repo.ts`,
`http/routes/{days,meals,entries,leftover,journal}.ts` + controllers. DTOs
`shared/src/dto/day.ts`.
Web: `features/meals/` (full decomposition incl. `modals/LeftoverModal/`,
`CustomFoodModal/`, `CookModeModal/`), `features/journal/`, `api/{days,meals,entries,
leftover,journal}.ts`, components `DataTable/`, `VerdictBadge/`, `MetricCard/`,
`Toast/` (block-and-warn). `LeftoverModal` previews via API — **no client proration**.

## Acceptance criteria (neutral oracles)

- **day-verdict.test.ts:** OK / NOK-DÉPASSÉ / NOK-SOUS (`2000`/`2200`/`0` vs
  `1900–2100`); snapshot resolution by date; effective verdict = override ?? auto.
- **leftover.test.ts:** canonical plate (`Food A/B/C` served 500/300/200, gross 508
  tare 408 → consumed 450/270/180, `Side D` 125 untouched, ×0.9); both block cases
  (`gross<tare`, `net>served`); re-edit recompute.
- **Integration** (`testing.md` §2): leftover **409 `gross_below_tare`**, **409
  `leftover_exceeds_served`**, **nothing written on block**; tenancy → 404;
  a frozen past day is unaffected by a later target/weigh-in change.
- **e2e:** Daily-log entry flow (add referenced line → totals + verdict update);
  Leftover flow (multi-select → preview → apply scales consumed; block case warns and
  writes nothing).

## Size check

Repas is the worked example of the file-size discipline — follow the exact
decomposition in `modularity.md` §2; no component approaches 300 lines; modals are
feature-local folders, not inline.

## Sub-passes (M3 split — approved, too large for one safe pass)

M3 is delivered in three commits, each CI-green before the next:

- **M3a — backend** (DB + domain + API + integration tests). **DONE** (this commit).
- **M3b — Repas screen** (page + components + LeftoverModal + CustomFoodModal +
  Autocomplete) + e2e entry/leftover. _Not started._
- **M3c — Journal screen** (read view + pill) + e2e. _Not started._ (The journal **API**
  ships in M3a; only the screen is M3c.)

## Checklist

- [x] day aggregate tables + migration; day.repo (scoped, whole aggregate — split into
      `day.repo` / `day-read.repo` / `entry.repo` / `leftover.repo` for the 300-line rule)
- [x] domain/day-verdict + neutral oracle tests
- [x] domain/leftover + neutral oracle tests (plate + both blocks + re-edit)
- [x] domain/serving (quantity→grams + macro snapshot) + neutral oracle tests
- [x] services days/meals/entries/leftover/journal + routes/controllers + DTOs
- [ ] Repas screen decomposed per modularity §2 + the three feature modals → **M3b**
- [ ] Journal read view + pill → **M3c** (journal API done in M3a)
- [x] integration: leftover 409s (nothing written), tenancy 404, frozen-past stability
- [ ] e2e: daily-log entry + leftover (apply + block) → **M3b**
- acceptance (M3a): day-verdict/leftover/serving neutral oracles + listed integration green;
  typecheck + lint + check:schema clean

## M3a scope notes (discovered dependencies + deferrals — tracked elsewhere)

- **Pantry / meal_slot_template / pin-unpin → M7.** M3a does not build the
  `meal_slot_template` / `pantry_item` tables or the pin/unpin endpoints. The
  `meal_entry.is_pinned` column exists (contract) but stays `false`. New days are
  materialized with a **default** set of meal slots (`DEFAULT_MEAL_SLOTS` in
  `services/days.ts`) instead of template+pantry prefill. (Tracked in `M7-settings-pantry.md`.)
- **Cook mode (CookModeModal) → M9.** (Tracked in `M9-polish.md`.)
- **`container` table added in M3a (ahead of its M7 Contenants screen).** The leftover
  endpoint must resolve a container to freeze its name + tare; the 409 `gross_below_tare`
  acceptance needs a tare > 0. M3a adds the table + a read-only `container.repo` and seeds
  nothing — `container_id: null` resolves to the built-in "Rien" (tare 0). Full Contenants
  CRUD/screen + "Rien" seeding stay in M7.
- **New domain module `domain/serving/`** (quantity→grams + macro snapshot). Not in
  `module-map.md`; justified by `spec/logic/00-conventions.md` §Units. `ml → g` is 1:1
  (no density field exists anywhere in the schema — the only coherent contract reading).
- **`scripts/check-schema.mjs` parser fix (tooling, not a contract):** its table-heading
  regex now tolerates a trailing parenthetical (e.g. `## leftover_group  (OPEN_GAPS #13)`),
  so the gate validates these contract tables too (strictly more faithful). 11 tables match.
- **verdict_auto is computed on read** (assembler) and persisted as a cache on materialize/
  patch/today-reads; per-mutation cache refresh for Stats is wired with M6. Reads are always
  correct: past days use the frozen stored snapshot, today recomputes live and re-persists.

### Carried over from M1 (build here)

- [ ] **Autocomplete dropdown** (`components/Form/Autocomplete`, `design/components/
forms-inputs.md` §"Autocomplete dropdown") for the entry/food picker — the Daily-log
      consumer of `GET /search/loggable`. M1 built only the table SearchField; the dropdown
      with keyboard nav, match highlight, portion/recipe tags, and the custom-food option is
      built here where it is first used.
