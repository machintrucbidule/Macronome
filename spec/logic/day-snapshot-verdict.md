# Logic spec — day target-snapshot & OK/NOK verdict

Covers OPEN_GAPS #1 (snapshot timing) and the calorie-only auto verdict with
manual override. See `00-conventions.md`, `targets-macros.md`.

## 1. DayLog lifecycle
- A `DayLog` is created **lazily on the first interaction** with a date: first
  `MealEntry`, first verdict/activity/comment edit, or import (summary days).
- Never-touched calendar days have **no** `DayLog` (they are "not logged":
  excluded from the OK rate, grey on the heatmap).

## 2. target_snapshot — what it stores
At creation the DayLog freezes a snapshot of the targets **in effect on that
day's own date**:
- `cal_min`, `cal_max` — from the `Target` whose `effective_from` is the latest
  one ≤ the day's date.
- `protein_floor_g`, `fat_floor_g`, `carb_ceiling_g` — computed (per
  `targets-macros.md`) on the **body weight in effect on that date** (most recent
  weigh-in dated ≤ the day).

## 3. Snapshot timing rule (OPEN_GAPS #1)
- **While `day.date == today`:** the snapshot **recomputes live** whenever the
  active Target or the current weight changes (so correcting today's target or
  weighing in today updates today's tiles and verdict).
- **Once `day.date < today`:** the snapshot is **frozen**. Later edits to Target
  rows or to weigh-ins never alter it.
- **Re-opening a past day** to add/edit entries uses the values of **that day's
  own date** (its already-frozen snapshot), not today's.
- Implementation note: persist the snapshot columns on the row; treat them as
  authoritative when `date < today`, and as recomputable (recompute-on-read or
  on-write) while `date == today`.
- Rationale: only `cal_min/cal_max` feed a stored verdict (auto is
  calorie-only); the gram thresholds are display-only. Freezing keeps the OK/NOK
  history and the Stats OK-rate stable when targets/weight change later.

## 4. Day calorie total
- **Detailed day:** `day_kcal = Σ over meals of Σ over entries of entry.consumed_kcal`
  where `consumed_kcal` is the entry's snapshot kcal scaled by consumed/served
  (see `leftover-proration.md`). Pantry lines at qty 0 contribute 0.
- **Summary day:** `day_kcal = summary_kcal`.

## 5. Auto verdict — CALORIE-ONLY
```
verdict_auto = OK   if cal_min ≤ day_kcal ≤ cal_max
             = NOK  otherwise   (below min OR above max)
```
- Snapshot's `cal_min/cal_max` are used, so a past verdict is stable.
- Macros never enter the auto verdict (RECONCILIATION_LOG; history.md).
- Status words for the calorie card: `SOUS` (< min), within range (OK),
  `DÉPASSÉ` (> max).
- **Worked example** (oracle):
  `inputs: day_kcal=2000, cal_min=1900, cal_max=2100 → verdict_auto=OK`
  `inputs: day_kcal=2200, cal_min=1900, cal_max=2100 → verdict_auto=NOK (DÉPASSÉ)`
  `inputs: day_kcal=0,    cal_min=1900, cal_max=2100 → verdict_auto=NOK (SOUS)`

## 6. Manual override
- `verdict_override ∈ {OK, NOK, null}`; `null` = use auto. Sticky once set.
- This is the lever for **macro/quality adherence** (calorie-only auto + the user
  forces NOK/OK when macros or context warrant).
- **effective verdict** = `verdict_override ?? verdict_auto`.

## 7. Per-day activity & constat (Repas)
- `DayLog.activity_level` (one of the five) drives the **day's** estimated burn:
  `burn = BMR(weight on the day) × activity_multiplier`; `deficit = day_kcal −
  burn` (see `metabolic-engine.md`). Shown as a **constat next to** the verdict,
  never as a verdict. Not stored (derived).
