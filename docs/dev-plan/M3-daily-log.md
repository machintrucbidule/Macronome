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

## Checklist

- [ ] day aggregate tables + migration; day.repo (scoped, whole aggregate)
- [ ] domain/day-verdict + neutral oracle tests
- [ ] domain/leftover + neutral oracle tests (plate + both blocks + re-edit)
- [ ] services days/meals/entries/leftover/journal + routes/controllers + DTOs
- [ ] Repas screen decomposed per modularity §2 + the three feature modals
- [ ] Journal read view + pill
- [ ] integration: leftover 409s (nothing written), tenancy 404, frozen-past stability
- [ ] e2e: daily-log entry + leftover (apply + block)
- acceptance: day-verdict & leftover neutral oracles + listed integration/e2e green
