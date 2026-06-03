# M6 — Stats & adherence

**Goal:** the read-only adherence analytics over frozen history — rolling windows,
heatmap, monthly pivots, key figures, streak, best month, factual signals.
Depends-on: M3 (effective verdicts + day_kcal). No new writable schema.

## Scope (`spec/logic/stats-adherence.md`)

- Logged day = a DayLog carrying a calorie value (detailed Σ or summary). Comment-only
  days are not logged.
- Rolling 7/14/30/365 (Gap 2): window = calendar dates `[L−N+1, L]` (L = latest logged
  day); average over logged days inside; OK-rate denominator = logged days in window
  (unlogged excluded, never NOK).
- Calendar heatmap (green OK / red NOK / **grey not-logged**); monthly OK/NOK pivot;
  avg kcal per month split OK/NOK over the target band.
- Key figures: year & overall OK rate; **current OK streak** over the ordered logged-day
  sequence (unlogged skipped, NOK ends it); **best month** = highest ok_rate among
  months with **≥5 logged days** (`BEST_MONTH_MIN_DAYS`), ties → more logged days →
  most recent.
- Signals (factual, named thresholds): 30-day avg vs target; current NOK run ≥
  `NOK_RUN_ALERT=3`; 14-day OK rate. No motivational messaging.
- Stats screen (`specifications/screens/stats.md`, `stats.html`): rolling cards,
  heatmap, pivots, figures, signals, year selector, empty/partial states.

## Files (via `module-map.md`)

API: `domain/stats/` (+ `stats.test.ts`), `services/stats.ts` (reads day aggregates
via `day.repo`), `http/routes/stats.ts` + controller. DTOs `shared/src/dto/stats.ts`;
`tuning.ts` constants.
Web: `features/stats/`, `api/stats.ts`, components `Chart/` (heatmap + bars),
`MetricCard/`, `states/`.

## Acceptance criteria (neutral oracles)

- **stats.test.ts:** rolling-7 with gaps excluded (the spec §2 neutral window:
  `avg=1600`, `ok_rate=3/5=60%`, 2 unlogged excluded); streak across gaps (unlogged
  skipped, NOK breaks); best month ≥5-day rule + tie-break; signals thresholds.
- **Integration:** stats endpoints return the documented shapes; summary days carry a
  verdict/colour; tenancy → 404.
- **e2e (smoke):** open Stats with seeded days → rolling cards + heatmap render;
  empty-year shows the empty state.

## Size check

Stats domain is several small pure functions (rolling/okRate/heatmap/monthlyPivot/
streak/bestMonth/signals); chart wrappers small. ≤300 lines each.

## Checklist

- [ ] domain/stats + neutral oracle tests (rolling, streak, best-month, signals)
- [ ] stats service (read-only over day aggregates) + route/controller + DTOs
- [ ] Stats screen: rolling cards, heatmap, pivots, figures, signals, year selector
- [ ] integration: endpoint shapes, summary-day colour, tenancy 404
- acceptance: stats neutral oracles + listed integration cases green
