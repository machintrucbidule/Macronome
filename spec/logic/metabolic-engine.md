# Logic spec — metabolic engine (BMR, burns, deficit)

Inputs from the profile (sex, birthdate→age, height), the current/period weight
(weight tracking), and activity (per-day on Repas; recent-avg on Cibles;
period-avg on Poids). See `00-conventions.md`.

## 1. Age (derived)

`age_years = whole years between birthdate and the reference date`
(the day being computed; on Cibles the reference date is today).

- Domain: birthdate < reference date; age ≥ 0.
- Example: birthdate 1986-01-01, ref 2026-06-02 → `age = 40`. (Age is recomputed
  from the birthdate against the reference date, never stored.)

## 2. BMR — Mifflin-St Jeor

`BMR = 10×weight_kg + 6.25×height_cm − 5×age_years + s`
where `s = +5` if male, `s = −161` if female.

- Domain: weight_kg > 0, height_cm > 0, age ≥ 0, sex ∈ {male, female}.
- Rounding: store exact; display integer.
- **Worked example** (oracle):
  `inputs: weight_kg=80, height_cm=180, age=40, sex=male`
  `→ BMR = 800 + 1125 − 200 + 5 = 1730 kcal/day`.
- **Worked example 2:** `weight_kg=90, height_cm=180, age=40, sex=male`
  `→ 900 + 1125 − 200 + 5 = 1830 kcal/day`.

## 3. Estimated burn (theoretical)

`estimated_burn = BMR × activity_multiplier`

- The multiplier source depends on the screen (see header).
- Domain: multiplier ∈ the five canonical values.
- **Worked example:** `BMR=1730, activity=sedentary(1.2)`
  `→ estimated_burn = 2076 kcal/day`.
- **Worked example (Cibles, recent-avg activity):** if the last ~30 logged days
  average to multiplier 1.30 and `BMR=1830` → `2379 kcal/day`.
  (Recent-average activity = mean of the last 30 `DayLog.activity_level`
  multipliers as of today; every logged day carries an activity level — at least
  `sedentary`, never unset — so all logged days in the window count. Only when there
  is **no** logged day at all does it fall back to sedentary and flag "insufficient data".)

## 4. Empirical (back-calculated) burn — PER DAY

`empirical_burn_per_day = avg_daily_intake + lost_kg × 7700 / days`

- `avg_daily_intake` = mean kcal over the **logged** days of the span.
- `lost_kg = weight_start − weight_end` (positive when losing).
- `days` = span length in days (gap between the two weigh-ins; ≥ 1, see
  `weight-periods-trajectory.md`).
- Always **per day**, never a period total (RECONCILIATION_LOG §B2).
- **Worked example** (oracle):
  `inputs: avg_daily_intake=2000, weight_start=80.0, weight_end=79.5, days=7`
  `lost_kg = 0.5 → empirical = 2000 + 0.5×7700/7 = 2000 + 550 = 2550 kcal/day`.

## 5. Deficit — uses ESTIMATED burn

`deficit_per_day = avg_daily_intake − estimated_burn_per_day` (intake − burn)

- Negative = real deficit; positive = surplus.
- The burn term is the **estimated** burn (BMR×activity), **not** the empirical
  burn. (Using empirical would be tautological: `intake − (intake + lost×7700/
days) = −lost×7700/days`, i.e. just the weight-change energy; the informative
  figure is intake vs theoretical expenditure.)
- kg/week equivalent: `deficit_per_day / 7700 × 7`.
- **Worked example** (oracle, per day):
  `avg_intake=2000, estimated_burn_per_day=1730×1.2=2076`
  `→ deficit = 2000 − 2076 = −76 kcal/day  (×7 = −532)`
  `→ kg/week = −76/7700×7 = −0.069 ≈ −0.07 kg/week`.

## 6. Cibles "deficit at target" (constat) — OPEN_GAPS #5

Reference intake = **midpoint** of the calorie range `(calorie_min+calorie_max)/2`.
`deficit_at_target = midpoint − estimated_burn` (recent-avg activity).

- **Worked example:** `calorie_min=1900, calorie_max=2100 → midpoint=2000`;
  `estimated_burn=2379 → deficit_at_target = 2000 − 2379 = −379 kcal/day`
  `→ kg/week = −0.34`.

## Reference data — activity descriptions (OPEN_GAPS #11)

| key               | FR description                                                                                  | EN description                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| sedentary         | Travail de bureau, peu ou pas d'exercice.                                                       | Desk job, little or no exercise.                                                   |
| lightly_active    | Exercice léger (marche lente) ou sport 1 à 3 jours par semaine.                                 | Light exercise (slow walking) or sport 1–3 days/week.                              |
| moderately_active | Exercice modéré (marche rapide, jogging léger, natation) ou sport 3 à 5 jours par semaine.      | Moderate exercise (brisk walking, light jogging, swimming) or sport 3–5 days/week. |
| very_active       | Exercice intense (entraînement sportif régulier, travail physique) 6 à 7 jours par semaine.     | Intense exercise (regular training, physical work) 6–7 days/week.                  |
| extremely_active  | Athlètes de haut niveau, travail physique très intense ou entraînements quotidiens très lourds. | Top-level athletes, very intense physical work or heavy daily training.            |
