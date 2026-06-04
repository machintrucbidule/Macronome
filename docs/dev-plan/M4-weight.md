# M4 — Weight & variable periods

**Goal:** weigh-ins, variable-length periods, EMA trend, broken-line trajectory, BMI,
and projection. Depends-on: M2 (BMR for period burns), M3 (logged-day intake for
per-period `avg_intake`).

> **Pre-existing from M2:** the `weight_entry` table + migration already exist (created
> early in M2 so the metabolic engine could read the current weight). A minimal
> `weight.repo.latestAsOf` is in place. M4 **does not** add table DDL — it adds the
> weigh-in CRUD (POST/PATCH/DELETE), period derivation, EMA, trajectory and the screen,
> extending the existing `data/repositories/weight.repo.ts`.

## Scope

- `weight_entry` (`spec/schema/tables-weight-targets.md`): `date` (editable),
  `weight_kg`, `waist_cm?`, `diet_flag` (in/not-in diet), `note?`. **One weigh-in per
  day** — onto an occupied date replaces/updates (confirmation). Activity not stored
  here. (Table already created in M2; see the note above.)
- Pure weight (`spec/logic/weight-periods-trajectory.md`): `derivePeriods` (span =
  date(next)−date(prev) ≥1; editing a date re-derives adjacent periods), `ema`
  (α=0.35 over the weigh-in series, seeded at first real weight), `trajectory`
  (broken line, anchored, in/not-in diet, goal cap), `bmi`, `projectGoalDate`
  (opt-in, Maintien gates it off), single/empty handling.
- Per-period table stats reuse `domain/metabolic` (estimated/empirical burn, deficit,
  Δ) — all per-day.
- Poids screen (`specifications/screens/weight.md`, `weight.html`): weigh-in entry,
  EMA + trajectory chart + cartouche, period table, current mode (Régime/Maintien,
  Weight-screen-local).

## Files (via `module-map.md`)

API: `domain/weight/` (+ `weight.test.ts`), `services/weight.ts`,
`data/repositories/weight.repo.ts`, `http/routes/weight.ts` + controller. DTOs
`shared/src/dto/weight.ts`; `tuning.ts` (`EMA_ALPHA=0.35`).
Web: `features/weight/`, `api/weight.ts`, components `Chart/` (weight EMA+trajectory,
cartouche), `MetricCard/`, `Form/`, `states/`.

## Acceptance criteria (neutral oracles)

- **weight.test.ts:** EMA chain (`[80.0,79.0,78.0],α0.35 → 79.7, 79.1`); broken-line
  trajectory (`anchor 80.0, rate 1.0, goal 72 → 79.0/79.0/77.0`; real 78.0 →
  écart +1.0); BMI (`80/180 → 24.7`); projection (`ema 80.0, goal 72, slope −0.05 →
~160 d`; `slope≥0 → non-baissière`; `ema≤goal → atteint`); single/empty weigh-in.
- **Integration** (`testing.md` §2): **409 `weigh_in_date_occupied` with `existing_id`**;
  editing a weigh-in date **re-derives periods**; tenancy → 404.
- **e2e:** add weigh-ins → see EMA + trajectory + a derived period; edit a date →
  watch periods re-derive.

## Size check

Chart wrappers and the period table decompose into small components; the EMA/
trajectory maths live only in `domain/weight` (server), the chart renders results.

## Build split (approved): M4a backend (done) · M4b screen (done)

**M4b — Poids screen DONE:** `features/weight/` (page + `WeightBody`, `useWeight` query/mutations,
`useWeightController` UI state, `format`); shared `components/Chart/` (`WeightChart` SVG +
`RangeControl` + `ChartLegend` + pure `scale`); `Cartouche` (5 `MetricCard`s), `PeriodTable`/
`PeriodRow`, `WeighInModal` (+ `WeighInFields`, `FlagToggle`, date-occupied replace), `WeightHeader`
with the ephemeral Régime/Maintien toggle; route `/weight` + nav (Repas · Journal · **Poids** ·
Aliments · Cibles); FR+EN i18n. e2e green (weigh-ins → EMA/trajectory/period; date edit re-derives).

## Deferred (tracked)

- **Current mode (Régime/Maintien) is ephemeral / client-side in M4.** `GET /weight`
  returns `current_mode` (default = latest period's `diet_flag`); the screen toggles it in
  React state and applies the projection's Maintien gate locally. **Persistence → M7**: the
  API contract defines no write endpoint for `current_mode` (neither `/weight` nor the
  `/settings` DTO lists it). `app_user.settings` is already a `Json` column, so M7 needs only
  an endpoint (a contract decision), no migration. See `M7-settings-pantry.md` carry-in note.

## Checklist

- [x] weight_entry table + migration (done in M2) · [x] one-per-day replace rule (M4)
- [x] domain/weight + neutral oracle tests (EMA, trajectory, BMI, projection, edges)
- [x] weight service + repo (re-derive on date edit) + route/controller + DTOs
- [x] Poids screen: entry, chart, period table, mode toggle
- [x] integration: 409 date-occupied (+existing_id), date-edit re-derive, tenancy 404
- [x] e2e: weigh-ins → EMA/trajectory/period; date edit re-derives
- acceptance: weight neutral oracles + listed integration green (M4a); e2e green (M4b) ✓
