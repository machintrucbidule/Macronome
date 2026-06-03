# M2 — Targets & metabolic engine

**Goal:** the pure metabolic calculations and the manual-target resource with derived
macro floors/ceiling. No day dependency yet — this is the engine M3/M4 consume.
Depends-on: M0. (Can proceed in parallel with M1.)

## Scope

- `target` table (`spec/schema/tables-weight-targets.md`): `calorie_min/max`,
  `protein_g_per_kg`, `fat_g_per_kg`, optional `target_weight_kg`/`rate_kg_per_week`,
  `effective_from`. Carbs never entered (derived).
- Pure engine (`spec/logic/metabolic-engine.md`): `age`, `bmr` (Mifflin-St Jeor),
  `estimatedBurn`, recent-avg activity burn, `empiricalBurnPerDay`, `deficitPerDay`,
  `deficitAtTarget` (midpoint, Gap 5). Sign convention `deficit = intake − burn`.
- Pure targets (`spec/logic/targets-macros.md`): `proteinFloorG`, `fatFloorG`,
  `carbCeilingG` (**may be ≤0; never clamped, no throw**), `suggestRange` (opt-in,
  never auto-writes). Floors use current weight (latest weigh-in ≤ ref date).
- Targets/Cibles screen (`specifications/screens/targets.md`, `targets.html`):
  manual inputs, derived tiles, "deficit at target" constat, the suggest dialog, and
  the carb-inconsistency warning (no clamp, save allowed).
- Activity constants single-sourced in `shared/src/constants/activity.ts` (5 levels)
  and `energy.ts` (9/4/4, 7700).

## Files (via `module-map.md`)

API: `domain/metabolic/` (+ `metabolic.test.ts`), `domain/targets/`
(+ `targets.test.ts`), `services/targets.ts`, `data/repositories/target.repo.ts`,
`http/routes/target.ts` + controller. DTOs `shared/src/dto/target.ts`; constants
`shared/src/constants/{energy,activity,tuning}.ts`.
Web: `features/targets/`, `api/target.ts`, components `MetricCard/`,
`Toast/` (carb-inconsistency), `Form/`, `Modal/` (suggest confirm).

## Acceptance criteria (neutral oracles from the synced spec)

- **metabolic.test.ts:** BMR ×2 (`80/180/40→1730`, `90/180/40→1830`); estimated burn
  (`1730×1.2→2076`); recent-avg burn (`1830×1.30→2379`); empirical
  (`2000,80,79.5,7→2550`); deficit (`2000−2076→−76`, `−0.07 kg/wk`); deficit-at-target
  (`mid 2000 − 2379 → −379`, `−0.34 kg/wk`).
- **targets.test.ts:** floors + carb ceiling (`2100,1.80,0.80,80 → P144/F64/237.0`);
  **carb ceiling ≤0** (`1200,2.00,1.00,80 → −40.0`, not clamped, no throw); suggest
  range (`B2076,D−300 → [1726,1826]`).
- **Integration:** carb ceiling ≤0 → **200 + `warnings:['carb_ceiling_non_positive']`**,
  save succeeds; another user's target → 404; malformed → 422.
- **e2e (smoke):** set a target, see derived tiles; trigger the negative-carb warning.

## Size check

Engine is many small pure functions across `metabolic/` and `targets/`; each file one
function group ≤300 lines. Web tiles reuse `MetricCard/`.

## Checklist

- [x] target table + migration; constants in shared (energy/activity/tuning)
- [x] domain/metabolic + neutral oracle tests (all §1 cases)
- [x] domain/targets + neutral oracle tests (incl. carb≤0)
- [x] targets service + repo + route/controller + DTOs
- [x] Cibles screen: inputs, derived tiles, constat, suggest dialog, carb warning
- [x] integration: carb≤0 warning+save, tenancy isolation, 422
- [x] acceptance: every metabolic/targets neutral oracle + listed integration cases green

## Notes on what was delivered / deviated (for later sessions)

- **`weight_entry` created early (approved scope change).** M2's engine needs the
  current weight (latest weigh-in) for floors/BMR/carb-ceiling, but that table's home is
  M4. With the user's approval, the full `weight_entry` table (faithful to the schema
  contract) + migration `20260603213446_targets_weight` were created here, with a minimal
  `data/repositories/weight.repo.ts` exposing only `latestAsOf`. M4 builds the weigh-in
  CRUD, periods, EMA, trajectory and Weight screen on the existing table.
- **Tenancy test shape.** `target` has no per-id route (GET /target is self-scoped), so
  the tenancy check asserts isolation (another user sees `target:null`) + 401 unauth,
  rather than a 404-by-id (which the resource shape does not expose).
- **POST 201 / GET 200.** Saving returns 201 with the fresh readout; the carb-ceiling
  warning is asserted on the subsequent `GET /target` (200), matching the contract.
- **Profile endpoints added.** `GET/PATCH /profile` (sex/birthdate/height_cm) are part of
  this milestone — the Cibles screen hosts/edit the metabolic profile.
- **Deferred (M3):** real recent-avg activity (≈30-day mean of `DayLog.activity_level`)
  and `empirical_burn` — M2 ships the pure functions and falls back to sedentary (1.20)
  with an `insufficient_activity_data` flag; `empirical_burn` stays `null`. Weight-less
  state returns a `no_weight` flag and null weight-dependent figures.
- **Deferred (M9):** live-while-typing recompute of derived tiles (rule 2 — no client
  computation, no preview endpoint in the contract, so tiles refresh on save via
  `GET /target`); the BMI tile (engine readout has no BMI; M4's weight cartouche does);
  moving the Cibles entry into the account menu (it is in primary nav for now).
