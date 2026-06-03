# Logic spec — weight: periods, EMA, trajectory, projection

Covers §3.7, RECONCILIATION_LOG §B2/§E3, OPEN_GAPS #9 (EMA), §G2/§G4.
See `00-conventions.md`, `metabolic-engine.md`.

## 1. Weigh-ins & periods
- A `WeightEntry` = `date` (editable), `weight_kg`, `waist_cm?`, `diet_flag`
  (in_diet | not_in_diet — describes the period **ending** at this weigh-in),
  `note?`. **Activity is NOT stored here.**
- **One weigh-in per day** (RECONCILIATION_LOG §E3): adding/moving onto an
  occupied date **replaces/updates** that day's entry (confirmation). No 0-day
  periods ever exist.
- A **period** = the span between two consecutive weigh-ins, ordered by date.
  `days = date(next) − date(prev)` (≥ 1). Variable length, never forced to 7.
- Editing a weigh-in's date re-sorts and **re-derives the adjacent periods**.

## 2. Per-period stats (each over its exact span)
- `avg_intake` = mean `day_kcal` over the **logged** days in the span.
- `period_activity_multiplier` = mean of the span's daily activity multipliers
  (days with a `DayLog.activity_level`); if none, fall back to sedentary + flag.
- `estimated_burn_per_day = BMR(weight_end) × period_activity_multiplier`.
- `empirical_burn_per_day  = avg_intake + lost_kg × 7700 / days`
  (`lost_kg = weight_start − weight_end`).
- `deficit_per_day = avg_intake − estimated_burn_per_day` (intake − burn).
- `Δ = weight_end − weight_start` (kg).
- All per-day (RECONCILIATION_LOG §B2). See `metabolic-engine.md` for oracles.

## 3. EMA trend (OPEN_GAPS #9)
Over the **ordered weigh-in series** (each weigh-in is one point; no daily
resampling). Seeded at the first weigh-in's real weight; `α = 0.35` (named
constant).
```
ema[0] = weight[0]
ema[i] = α × weight[i] + (1 − α) × ema[i−1]
```
- **Worked example** (oracle): `weights = [80.0, 79.0, 78.0], α=0.35`
  `ema[0]=80.0`
  `ema[1]=0.35×79.0 + 0.65×80.0 = 79.65 ≈ 79.7`
  `ema[2]=0.35×78.0 + 0.65×79.65 = 79.0725 ≈ 79.1`

## 4. Target trajectory — broken line (§3.7, §G4)
Driven by each period's `diet_flag`. **Anchored on the first weigh-in's real
weight.** Built forward, period by period, in date order:
```
traj[0] = weight[0]                         (anchor = real first weigh-in)
for each period i ending at weigh-in i (days_i, flag_i):
  if flag_i == in_diet:
      drop = rate_kg_per_week × days_i / 7
      traj[i] = max(traj[i−1] − drop, goal_weight)   (capped at goal)
  else:  # not_in_diet
      traj[i] = traj[i−1]                              (flat)
```
- `rate_kg_per_week` and `goal_weight` come from the Target. If no goal weight,
  the cap is omitted (no floor).
- `écart_à_la_trajectoire = real_weight − traj` at each weigh-in.
- **Worked example** (oracle):
  `anchor=80.0, rate=1.0 kg/week, goal=72`
  `P1: in_diet, 7 days → drop 1.0 → traj=79.0`
  `P2: not_in_diet, 7 days → flat → traj=79.0`
  `P3: in_diet, 14 days → drop 2.0 → traj=77.0`
  if real at P3 = 78.0 → écart = 78.0 − 77.0 = +1.0 kg (behind plan).

## 5. BMI
`BMI = weight_kg / (height_cm/100)²`
- **Worked example:** `weight=80, height_cm=180 → 80/1.80² = 24.7`.
- Category labels (display): <18.5 underweight · 18.5–24.9 normal · 25–29.9
  overweight · ≥30 obese.

## 6. Projection (opt-in; only if goal weight set)
- Fit a line to the **recent EMA** (default: last 4 weigh-ins, ≥ 2 required) of
  `ema` vs `date`; let `slope` be kg/day.
- If `slope ≥ 0` (not downward) → show "tendance non baissière" (no date).
- If `current_ema ≤ goal` → show "atteint".
- Else `days_to_goal = (current_ema − goal) / (−slope)`; projected date =
  latest weigh-in date + `days_to_goal`.
- **Mode gate:** in **Maintien** mode, no loss projection is shown regardless.
- **Worked example:** `current_ema=80.0, goal=72, slope=−0.05 kg/day`
  `→ days_to_goal = 8.0/0.05 = 160 → ~160 days out.`

## 7. Current mode (Régime / Maintien) — Weight screen only
- Defaults to the latest period's `diet_flag`; editable.
- Effects are **local to the Weight screen**: pre-selects the diet flag on a new
  weigh-in, and gates the projection. Does not touch the calorie target, the
  Daily-log verdict, or anything else.

## 8. Empty / single weigh-in (§G2)
- No weigh-ins → empty state, prompt to add one; engine reports "no weight".
- Single weigh-in → no period yet (table dashes); BMI computable, no Δ, no burns.
