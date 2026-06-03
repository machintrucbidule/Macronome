# Logic spec — targets & derived macros

The calorie target is manual; the three macro thresholds are derived. The engine
never overwrites the manual targets. See `00-conventions.md`.

## 1. Manual inputs (Target)
- `calorie_min`, `calorie_max` (integer kcal). Domain: `0 < calorie_min ≤
  calorie_max`. The pilot of the OK/NOK verdict.
- `protein_g_per_kg`, `fat_g_per_kg` (≥ 0, 2 decimals). Floors entered as g per
  kg of **current** body weight.
- `target_weight_kg?`, `rate_kg_per_week?` (≥ 0): goal + desired loss rate.
- `effective_from` (date): when this Target row takes effect.
- Carbs are **never entered** (derived remainder).

## 2. Current weight
`current_weight_kg` = the most recent weigh-in with date ≤ the reference date
(today on Cibles; the day's own date for a DayLog snapshot, OPEN_GAPS #1).
If no weigh-in exists, the engine reports "no weight yet" and floors are not
computable.

## 3. Derived gram thresholds
```
protein_floor_g = protein_g_per_kg × current_weight_kg
fat_floor_g     = fat_g_per_kg     × current_weight_kg
carb_ceiling_g  = (calorie_max − protein_floor_g×4 − fat_floor_g×9) / 4
```
- The floors **recompute as weight changes**; the Daily log reads them; each
  DayLog freezes a snapshot (see `day-snapshot-verdict.md`).
- A day's macros are "good" when `protein ≥ protein_floor_g` **and**
  `fat ≥ fat_floor_g` **and** `carb ≤ carb_ceiling_g`. There is **no fat
  ceiling**. (These do not affect the auto verdict — calorie-only — they are
  display/quality indicators; the user forces NOK via override when macros
  warrant, see `day-snapshot-verdict.md`.)
- **Worked example** (oracle):
  `inputs: calorie_max=2100, protein_g_per_kg=1.80, fat_g_per_kg=0.80,
   current_weight_kg=80`
  `protein_floor_g = 144.0 ; fat_floor_g = 64.0`
  `carb_ceiling_g = (2100 − 576 − 576)/4 = 948/4 = 237.0 g`.

## 4. Edge — carb ceiling ≤ 0 (RECONCILIATION_LOG §E2, OPEN_GAPS-confirmed)
If `carb_ceiling_g ≤ 0`, the protein + fat floors alone meet/exceed
`calorie_max`. **Show the real (possibly negative) value with an explicit
"targets inconsistent" warning. Do NOT clamp to 0. Do NOT block saving** (the
user may be mid-edit).
- **Worked example** (oracle):
  `inputs: calorie_max=1200, protein_g_per_kg=2.00, fat_g_per_kg=1.00,
   current_weight_kg=80`
  `protein_floor_g = 160.0 (640 kcal) ; fat_floor_g = 80.0 (720 kcal)`
  `carb_ceiling_g = (1200 − 640 − 720)/4 = −160/4 = −40.0 g`
  `→ display "-40.0 g" + warning; save allowed.`

## 5. "Suggérer une cible depuis le déficit visé" (opt-in, never auto-writes)
Given a desired daily deficit `D` (negative) and the recent-avg estimated burn
`B`: proposed midpoint intake = `B + D`; proposed range = `[round(B+D) − h,
round(B+D) + h]` with default half-width `h = 50` kcal. Presented in a confirm
dialog; on accept it pre-fills `calorie_min/max` (still editable before save).
- **Worked example:** `B=2076, D=−300 → midpoint 1776 → range [1726, 1826]`.
