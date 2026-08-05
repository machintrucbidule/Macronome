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
  one ≤ the day's date. **If the day's date precedes every target, the earliest
  target applies** — it is retroactive to all dates before its own `effective_from`,
  so once any target exists no day ever resolves to a degenerate 0/0 range (and an
  empty pre-target day reads NOK, not OK). A target range is null only when the user
  has no target at all (B-090; `DECISIONS.md` "VR-1 / B-090").
- `protein_floor_g`, `fat_floor_g`, `carb_ceiling_g` — computed (per
  `targets-macros.md`) on the **body weight in effect on that date** (most recent
  weigh-in dated ≤ the day).

## 3. Snapshot timing rule (OPEN_GAPS #1)

- **While `day.date == today`:** the snapshot **recomputes live** whenever the
  active Target or the current weight changes (so correcting today's target or
  weighing in today updates today's tiles and verdict).
- **Once `day.date < today`:** the snapshot is **frozen**. Later edits to Target
  rows or to weigh-ins never alter it.
- **While `day.date > today` (a future/planned day):** behaves **like today** — the
  snapshot recomputes live and an auto verdict is produced, so the Repas screen shows
  the targets, totals and OK/NOK badge normally (the user plans meals ahead; B-016). It
  freezes only once its date becomes `< today`. **Future days are nonetheless excluded
  from every stats aggregate until their date arrives** — see `stats-adherence.md` §1.
- **Re-opening a past day** to add/edit entries uses the values of **that day's
  own date** (its already-frozen snapshot), not today's.
- Implementation note: persist the snapshot columns on the row; treat them as
  authoritative when `date < today`, and as recomputable (recompute-on-read or
  on-write) while `date == today`.
- Rationale: only `cal_min/cal_max` feed a stored verdict (auto is
  calorie-only); the gram thresholds are display-only. Freezing keeps the OK/NOK
  history and the Stats OK-rate stable when targets/weight change later.
- **Contrast — the garde-manger pin is NOT frozen** (unlike this snapshot): the 📌
  state is derived live from `pantry_item` on every read, so editing the pantry list
  changes the pin icon on past days too (it never changes their macros/verdict). See
  `pantry-pin.md` (B-045).
- **Sanctioned exception — opt-in target recompute (TH-1 / B-091).** Correcting a past
  target version leaves frozen days frozen **by default**. The single exception is an
  **explicit, user-triggered** recompute (`POST /targets/:id/recompute`): for the version's
  affected window it re-freezes `target_snapshot` and recomputes `verdict_auto` **only for
  logged days with `verdict_override IS NULL`**. Manually forced/overridden days, future
  days and out-of-window days are never touched, and the verdict formula (§5) is unchanged
  — so this re-aligns history to a corrected target without otherwise breaching the freeze
  rule. Each day re-resolves its snapshot via the §2 rule, so it re-freezes against whatever
  version now governs its date.

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

## 7. Per-day activity & deficit (Repas)

- `DayLog.activity_level` (always one of the five — defaults to `sedentary`, never
  unset; DECISIONS Gap #11) drives the **day's** estimated burn:
  `burn = BMR(weight on the day) × activity_multiplier`; `deficit = day_kcal −
burn` (see `metabolic-engine.md`). Shown as a burn/deficit readout **next to** the
  verdict, never as a verdict. Not stored (derived). Computable on every day that has
  a body weight; the readout is shown with a placeholder only when no weigh-in exists yet.
- The **Journal** exposes this same `deficit` (`day_kcal − burn`) per row as `burn_gap`
  (B-163), the écart vs the day's estimated expenditure, beside the activity selector — `null`
  on a non-logged day and when the day has no weigh-in (see `api/days-meals-leftover.md §Journal`).
- **NOK presentation split (B-166).** The binary OK/NOK verdict (§5–§6) is **unchanged**; only the
  **display of a NOK day** splits on this same `deficit`: a NOK day is shown **orange** when it is
  still in a real deficit (`intake ≤ burn`, i.e. `deficit`/`burn_gap ≤ 0`) and **red** on a surplus
  (`> 0`) **or when the burn cannot be computed** (no weigh-in on/before the date, or an incomplete
  profile → `null`). The comparison always uses the **day's own** `estimated_burn` (BMR of the weight
  in effect on that date × that day's `activity_level`), never a global/current value. It does **not**
  read `cal_min`/`cal_max`, so a `SOUS` (under-the-floor) NOK day is orange like any other deficit.
  OK is unchanged (green). Nothing is stored; this is presentation only (the figure is already
  derived). Surfaces: the verdict badge on Repas and the Journal (desktop row, mobile card + sheet).

## 8. Day states (day-model)

A day's **state** is derived server-side (never in the web — rule 2) from its calorie
value and its date relative to today (T). The _calorie value_ is: detailed → Σ consumed
kcal of its entries (§4); summary → `summary_kcal`; **absent** when there is no row, or
when a detailed day's entries sum to 0 (cleared, or pantry-only at qty 0).

| state    | condition                                                                                      | logged (counts in stats)? |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------- |
| `none`   | date > T and no calorie value (no row, or a planned row with Σ = 0)                            | no                        |
| `green`  | `kind='detailed'` with Σ kcal > 0                                                              | yes if date ≤ T           |
| `yellow` | `kind='summary'` (`summary_kcal` set — self-made light **or** imported)                        | yes if date ≤ T           |
| `red`    | date ≤ T and no calorie value (no row; a row with only comment/activity/verdict; detailed Σ=0) | **no**                    |

- **Derivation precedence:** summary → `yellow`; detailed with Σ kcal > 0 → `green`;
  otherwise (no row, or detailed with Σ = 0) → `red` when date ≤ T, `none` when date > T.
- A **comment-only / activity-only / verdict-only** day stays `red`: it exists but carries
  no calorie value, so it is **not "logged"** and is excluded from the OK-rate. This keeps
  the rate honest while the Journal still surfaces the gap (chosen: empty/zeroed days excluded).
- A **future** day with data renders per content (`green`/`yellow`) but is **excluded from
  every stats aggregate** until its date arrives (`stats-adherence.md §1`). A future day with
  no calorie value is `none`.
- **Logged day** (the stats unit, single-sourced here): `(green | yellow) AND date ≤ T` —
  i.e. "has a calorie value and is not in the future". `none` and `red` are never logged.
  This restates `stats-adherence.md §1` as the state-level rule.

**Worked examples** (oracles; T = today):

- detailed, Σ = 950, date ≤ T → `green`, logged.
- summary, summary_kcal = 1800, date ≤ T → `yellow`, logged.
- no row, date ≤ T → `red`, not logged.
- detailed, Σ = 0 (cleared / pantry-only at qty 0), date ≤ T → `red`, not logged.
- comment-only row (detailed, Σ = 0, comment set), date ≤ T → `red`, not logged.
- no row, date > T → `none`, not logged.
- detailed, Σ = 1500, date > T (planned) → `green`, **not** logged (future).
- summary, summary_kcal = 1600, date > T → `yellow`, **not** logged (future).

### 8b. Day tone — the compliance colour (B-262)

The **state** above is a _data-presence_ ladder ("does this day carry a calorie value?"). It is
**not** a compliance ladder, and the two must never be confused despite the overlapping colour
words. The **tone** is the compliance signal: it answers "is this day on target?", and it is the
single server-side source for every surface that colours a verdict — the day badge, the Journal
pill, and the window-level rule (`design/components/top-nav.md`).

| tone   | condition                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- |
| `none` | the day carries **no calorie value** (same "absent" test as §8) — nothing to judge yet         |
| `ok`   | effective verdict `OK`                                                                         |
| `warn` | effective verdict `NOK` **and** intake is still at or under the estimated burn (`deficit ≤ 0`) |
| `nok`  | effective verdict `NOK` and intake is over the burn, or the burn is unknown                    |

- **Derivation precedence:** no calorie value → `none`; else `OK` → `ok`; else `deficit ≤ 0` →
  `warn`; else → `nok`. The `deficit` is the day constat's signed burn gap
  (`metabolic-burn.md`); it is `null` when the day has no body weight yet, which reads as `nok`
  (an unknown burn is not evidence of a deficit).
- **`none` applies at any date**, past or future — unlike §8's state, the tone does not branch on
  the date. A past day with no calorie value has nothing to be compliant _with_; a future planned
  day with lines is judged on those lines like any other.
- The effective verdict is the manual override when set, else the auto value (§6), so forcing a
  day OK turns its tone `ok` too — the override is the lever, exactly as for the verdict itself.
- The tone is **derived, never stored**: no column, no snapshot. It is recomputed on each read
  from the day's own (frozen or live) snapshot, so it inherits §3's freezing rules for free.

**Worked examples** (oracles; snapshot `cal_min = 1800`, `cal_max = 2200`):

- no row, or detailed with Σ = 0 → `none` (whatever the verdict says).
- detailed, Σ = 2000 → auto `OK` → `ok`.
- detailed, Σ = 1500, burn 2400 (`deficit = −900`) → auto `NOK` (under `cal_min`) → `warn`.
- detailed, Σ = 2600, burn 2400 (`deficit = +200`) → auto `NOK` → `nok`.
- detailed, Σ = 2600, no weigh-in yet (`deficit = null`) → auto `NOK` → `nok`.
- detailed, Σ = 2600, `verdict_override = 'OK'` → effective `OK` → `ok`.
- summary, summary_kcal = 1900 → auto `OK` → `ok`.

## 9. Summary (light) days: creatable & freely convertible (day-model)

- Summary days are **creatable in-app**: a calorie total (`summary_kcal`) with no meal
  breakdown (primary entry point: the Journal Calories cell). They reuse the existing
  `kind='summary'` + `summary_kcal` shape and the `summary⇔summary_kcal` CHECK.
- **No provenance distinction.** Imported days (from the Excel migration) are treated like
  any other day — there is **no freeze** and no provenance marker. Every summary day, whatever
  its origin, is editable and freely convertible (author decision 2026-06-07, overriding the
  analysis doc's "freeze imported archives" scoping; see `DECISIONS.md` Gap 3).
- **Editable fields on a summary day (ED-1 / B-096).** `activity_level`, `comment`,
  `verdict_override` and `summary_kcal` are all directly editable on a summary day, past or
  present (imported history included) — no `readonly` lock. Editing `activity_level` recomputes
  the day's `constat` (estimated burn / deficit) on read; it does **not** change the calorie
  `verdict_auto`. Direct edits never recompute a **past** day's frozen `target_snapshot`
  (CLAUDE.md rule 4): the freeze rule only governs _later_ edits to a referenced food/target,
  not a direct edit of the day's own fields. The day total of a **detailed** day stays the
  read-only derived Σ (see the `409 calories_not_editable` below) — that is intended, not a lock
  to lift.
- **Conversion (all summary/detailed days):**
  - **light → detailed:** a summary day that receives meal detail becomes `detailed` (clears
    `summary_kcal`, sets `kind='detailed'`); its state then follows §8 (`green` once Σ > 0).
  - **detailed → light:** a detailed day becomes `summary` (sets `summary_kcal`,
    `kind='summary'`, drops its meals). Two paths (DK-1 / B-078):
    - _In-place edit (PATCH `summary_kcal`)_ — allowed **only when the day has no meal lines
      with Σ > 0**. A detailed day with real lines shows a read-only derived Σ (the Calories
      cell is not editable) → `409 calories_not_editable`. This guards against an accidental
      overwrite of a detailed day's computed total.
    - _Deliberate conversion (`POST /days/:date/summary`)_ — allowed **even when Σ > 0**: it
      **discards the day's meal lines** and sets `summary_kcal := the current Σ`, behind a
      **strong confirmation** (the client warns that the foods will be removed,
      `design/components/modals.md`). The day is then an editable Partiel day.
