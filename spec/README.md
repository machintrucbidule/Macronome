# Macronome — implementation-ready specification

Phase: detailed logical contract (after v2.2 reconciliation). Defines what the
system computes, stores, and exposes. No code, framework, file layout, testing,
deployment, or visual styling here.

Authority order: `specifications/masterplan.md` (v2.2) → `specifications/screens/*.md` →
`specifications/RECONCILIATION_LOG.md` → `DECISIONS.md` (this phase's resolutions of
`specifications/OPEN_GAPS.md`) → `specifications/suivi_poids.xlsx` (data ground truth).

## A. Domain logic & calculations  (`logic/`)
- `00-conventions.md` — units, rounding, signs, rating, activity, "as of".
- `metabolic-engine.md` — age, BMR, estimated/empirical burn, deficit.
- `targets-macros.md` — calorie target, derived floors/ceiling, carb ≤ 0.
- `day-snapshot-verdict.md` — target snapshot timing (#1), calorie-only verdict.
- `leftover-proration.md` — proration, block rules, re-edit, frozen container.
- `recipes-derived-food.md` — recipe macros, transitive cycles, derived food.
- `weight-periods-trajectory.md` — periods, EMA, broken-line trajectory, projection, BMI.
- `stats-adherence.md` — rolling windows (#2), OK rate, pivots, best month (#12).
- `migration-etl.md` — summary import (#3), (nb)/(poids) merge (#4), ratings, weight.

Every rule carries formula + units + rounding + sign, input domain/validation,
edge cases, and ≥1 worked `inputs → expected outputs` example (the test oracle).

## B. Data schema  (`schema/`)
- `00-overview.md` — conventions, extensions, entity map.
- `tables-catalog.md` — app_user, food, food_portion, recipe, recipe_ingredient, container.
- `tables-logging.md` — meal_slot_template, pantry_item, day_log, meal, meal_entry, leftover_group(+entry).
- `tables-weight-targets.md` — weight_entry, target.
- `indexes.md` — unaccent/pg_trgm autocomplete, tenant/lookup/stats indexes, integrity.

## C. API contract  (`api/`)
- `00-conventions.md` — auth/session, tenancy, error shape, status codes, lists, search, reserved hooks.
- `foods-recipes.md` — foods, recipes, combined log search, containers.
- `days-meals-leftover.md` — day, meals, entries, leftover, journal.
- `weight-targets-stats-settings.md` — weight, target/engine, stats, settings, template, pantry.

## Resolved gaps (see `DECISIONS.md`)
Domain: #1 snapshot timing · #2 rolling window · #3 summary-only import ·
#4 (nb)/(poids) merge · #5 deficit-at-target midpoint · #6 visibility ·
#13 re-editable leftover + frozen container.
UX/impl: #7 unrated "—" · #8 pantry editor · #9 EMA α=0.35 · #10 portion not
sortable · #11 activity descriptions · #12 best-month ≥5 days · #14 advisor hook.
