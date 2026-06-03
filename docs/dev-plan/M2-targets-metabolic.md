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

- [ ] target table + migration; constants in shared (energy/activity/tuning)
- [ ] domain/metabolic + neutral oracle tests (all §1 cases)
- [ ] domain/targets + neutral oracle tests (incl. carb≤0)
- [ ] targets service + repo + route/controller + DTOs
- [ ] Cibles screen: inputs, derived tiles, constat, suggest dialog, carb warning
- [ ] integration: carb≤0 warning+save, tenancy 404, 422
- acceptance: every metabolic/targets neutral oracle + listed integration cases green
