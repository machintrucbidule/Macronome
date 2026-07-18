# Logic spec — statistics & adherence

Covers §3.8, RECONCILIATION_LOG §E4, OPEN_GAPS #2 (windows) and #12 (best
month). Calorie/adherence-centric (no macro pivots), plus **weight records** (§9, B-197).
See `00-conventions.md`.

## 1. Logged day

A date is **logged** iff it has a `DayLog` carrying a calorie value (detailed Σ
entries, or summary `summary_kcal`). Days with a row but no calorie value
(e.g. comment-only) are **not** logged for stats.

**Future days (date > today) are excluded** from every stats aggregate until their
date arrives (B-016 — see `day-snapshot-verdict.md`). A day planned ahead may carry a
`DayLog` and a verdict (it behaves like today on the Repas screen), but stats only ever
consider dates ≤ today: rolling windows, heatmap, monthly pivots, the key figures
(year/overall OK rate, current OK streak, best month) and the signals all ignore it.
Once its date is ≤ today the same `DayLog` counts normally.

## 2. Rolling averages (7 / 14 / 30 / 365 days) — OPEN_GAPS #2

- Anchor `L` = the latest logged day (shown in the header). Window of `N` =
  calendar dates in `[L − N + 1, L]`.
- `avg_kcal_N = mean(day_kcal over the LOGGED days within the window)`.
- `ok_rate_N = (OK logged days within window) / (logged days within window)`,
  using each day's **effective verdict**. Unlogged days are **excluded**
  (never NOK).
- `vs_target_N` (position of the average vs the band: `below` / `in` / `above`) compares
  `avg_kcal_N` to the **mean of the per-day frozen bands** over the window's logged days that
  carried a real target — `mean_band_N = [mean(cal_min), mean(cal_max)]` over those days —
  **not** the current band. So a long window is never falsely "above" today's (possibly lower)
  band when older, higher targets actually applied — the position reflects the targets that were
  really in force (B-100; same family as the per-period weight rate, B-099). `null` when no logged
  day in the window carried a band.
- Rolling cards always reflect `L`, independent of the year selector.
- **Worked example** (oracle): window 7, dates 27 May–2 Jun; logged days =
  {28 May 1600 OK, 29 1700 NOK, 30 1500 SOUS/NOK, 1 Jun 1620 OK, 2 Jun 1580 OK};
  27 & 31 unlogged.
  `avg_kcal_7 = (1600+1700+1500+1620+1580)/5 = 1600`
  `ok_rate_7 = 3/5 = 60%` (27 & 31 excluded).
- **Worked example — `vs_target` per window** (oracle, B-100): 5 logged days at 1800 kcal, the
  first 3 under a `1900–2100` band, the last 2 under a later `1500–1700` band.
  `mean_band = [(1900·3+1500·2)/5, (2100·3+1700·2)/5] = [1740, 1940]`; `1800 ∈ [1740,1940]` →
  `vs_target = in` (against the **current** 1500–1700 band it would wrongly read `above`).

## 3. Calendar heatmap

One cell per calendar date in the selected year: green = effective OK,
**grey = not logged** (RECONCILIATION_LOG §E4). Summary days carry a verdict and
colour normally. A **future date (> today) is grey** (not logged) even if a plan
exists for it — it only takes its colour once its date has arrived (§1, B-016).

**Cell tooltip comment (B-226, display-only).** The cell's hover tooltip shows the day's
`comment` when it carries one — full text — **including on grey not-logged days** that hold a
comment. This is presentation only: it changes **no** cell colour/status and **no** figure
(the not-logged/grey rule above is untouched).

**NOK sub-tone (B-167).** A NOK cell splits by the day's expenditure, mirroring the
Repas/Journal badge (B-166): **orange** when the day is still in a real deficit
(`day_kcal ≤ estimated_burn`) and **red** when in a surplus (`day_kcal > estimated_burn`)
**or when the burn cannot be computed** (no weigh-in on/before the date, or an incomplete
profile). The `estimated_burn` is the **day's own** figure — `BMR(weight in effect on the
date) × activity_multiplier(that day's activity_level)` (see `metabolic-engine.md`;
`deficit = day_kcal − estimated_burn`, the same per-day basis as `day-snapshot-verdict.md
§7` and the Journal `burn_gap`). The binary OK/NOK verdict (§calorie-only) is unchanged —
only the NOK presentation splits. It does **not** read `cal_min`/`cal_max`, so a `SOUS`
(under-the-floor) NOK day is orange like any other deficit. The cell status is one of
`OK` / `NOK_under` (deficit, orange) / `NOK_over` (surplus or unknown burn, red) / `none`.

## 4. Monthly OK/NOK pivot

Per month (in the selected year):

- `ok_count`, `nok_count` over **logged** days; `ok_rate = ok_count /
(ok_count + nok_count)`.
- **NOK split (B-167):** `nok_count` further splits into `nok_under_count` (NOK days in a
  deficit, `day_kcal ≤ estimated_burn`) and `nok_over_count` (surplus, or unknown burn) —
  same per-day basis as §3; `nok_under_count + nok_over_count = nok_count`. `ok_count` is
  unchanged.
- Rendered as **3-segment** stacked bars (OK green bottom → NOK-deficit orange middle →
  NOK-surplus red top) with the OK% label.

## 5. Average calories per month, split OK/NOK

Per month: `avg_kcal_ok = mean(day_kcal over OK logged days)`,
`avg_kcal_nok = mean(day_kcal over NOK logged days)`; grouped bars over the
shaded target zone `[cal_min, cal_max]`.

A third figure, `avg_kcal_global = mean(day_kcal over ALL logged days of the
month)` (OK **and** NOK combined), feeds a global-average polyline + dots over the
bars. It is never null — a month present in the pivot has ≥ 1 logged day.

> **Worked example.** A month with three logged days — OK `1600`, OK `1500`,
> NOK `1800` — gives `avg_kcal_ok = (1600+1500)/2 = 1550`,
> `avg_kcal_nok = 1800`, and `avg_kcal_global = (1600+1500+1800)/3 = 1633.33…`.

**Per-month target zone (CZ-1/B-141).** The shaded band is resolved **per month**
from the Target in effect on the month's **end date** (last calendar day): the latest
`effective_from ≤ end_date`, falling back to the **earliest** Target for months before
any Target exists (retroactive — mirrors the calorie resolution in
`day-snapshot-verdict.md §2` / B-090 and the per-period weight rate in
`weight-periods-trajectory.md §4` / B-099). The band therefore **steps** at each target
boundary, so a year spanning several targets is shaded faithfully rather than at the
current band throughout. It is `null` only when the user has no Target at all. Each
`monthly` entry carries its own `target_zone`; the response's top-level `target_zone`
(the band in effect **today**) is unchanged and still drives the rolling-card / signals.

> **Worked example — per-month band** (oracle, CZ-1/B-141): targets `[1500,1600]` then
> `[1400,1500]` from `effective_from = 2026-04-01`. March (end date `2026-03-31`, before
> the switch) is shaded `[1500,1600]`; May (end date `2026-05-31`, after) is shaded
> `[1400,1500]`; February (before any target — but the earliest is `2026-01-15`) falls
> back to the earliest band `[1500,1600]`. The band steps down between March and May.

## 6. Key figures

- **Year OK rate** = OK / logged days in the selected year.
- **Overall OK rate** = OK / logged days across all history.
- **Current OK streak** = run of consecutive effective-OK days over the **ordered
  sequence of logged days**, counting back from `L`. Unlogged days are skipped
  (neither counted nor breaking); a NOK logged day ends the run.
- **Best month** (OPEN_GAPS #12): the month with the highest `ok_rate`, among
  months with **≥ 5 logged days** (named constant `BEST_MONTH_MIN_DAYS = 5`).
  Ties broken by more logged days, then most recent.

## 7. Signals (rule-based, factual)

Examples (thresholds are named constants):

- 30-day average vs target: if `avg_kcal_30 > cal_max` → "30-day average N kcal
  above target" (`N = avg_kcal_30 − cal_max`); symmetric below `cal_min`.
- Current NOK run: count of consecutive most-recent logged NOK days. Surface
  `nok_run` if ≥ `NOK_RUN_ALERT = 3`; otherwise surface the positive counterpart
  `nok_run_clear` ("no NOK streak in progress"). Exactly one of the two is emitted
  whenever there is at least one logged day (B-058).
- 14-day OK rate readout.
  No motivational messaging.

Each signal carries a `status` (`ok` | `warn` | `info`) that drives the design's
status dot (`charts.md` §Signals: `.ok→--ok / .warn→--nok / .info→--under`). The
mapping is **server-decided** (the web never derives a verdict — rule 2):

| code                 | status                                          |
| -------------------- | ----------------------------------------------- |
| `avg30_above_target` | `warn`                                          |
| `avg30_below_target` | `info`                                          |
| `nok_run`            | `warn`                                          |
| `nok_run_clear`      | `ok`                                            |
| `ok_rate_14`         | `ok` if `value ≥ OK_RATE_GOOD_PCT`, else `warn` |

`OK_RATE_GOOD_PCT = 70` is a named constant (the 14-day OK-rate "good" threshold).

## 8. Empty / partial

- No logged days → empty state + prompt.
- Partial year → empty heatmap cells for dates with no data.

## 9. Weight records (B-197)

Four figures derived from the user's weigh-ins (`weight_entry`, one row per date;
`@@unique(user, date)`). Not calorie/adherence data — the only non-adherence block here.

- **All-data**: `high` = the max `weight_kg` over **all** weigh-ins, `low` = the min.
- **Selected year**: same, restricted to weigh-ins whose `date` falls in the requested
  `year` (the Stats year selector; default = current year).
- Each of `high` / `low` is `{ weight_kg, date }` — the weight and the **date of that
  weigh-in** — or `null` when the scope has no weigh-in (no data, or an empty year).
- **Tie-break:** if the record weight was reached on several days, return the **most-recent**
  date (matches §6 best-month's most-recent tie-break).
- Server-computed (rule 2); the web only renders the four values + dates.

**Worked examples (oracles).** Weigh-ins: `2024-11-02 → 82.0`, `2025-03-10 → 78.5`,
`2025-08-01 → 80.0`, `2025-08-20 → 78.5`, `2026-01-15 → 79.0`.

- All-data: `high = {82.0, 2024-11-02}`, `low = {78.5, 2025-08-20}` (78.5 reached
  2025-03-10 **and** 2025-08-20 → most-recent wins).
- Year 2025: `high = {80.0, 2025-08-01}`, `low = {78.5, 2025-08-20}`.
- Year 2026: `high = {79.0, 2026-01-15}`, `low = {79.0, 2026-01-15}` (single weigh-in).
- Year 2023 (no weigh-in): `high = null`, `low = null`.
