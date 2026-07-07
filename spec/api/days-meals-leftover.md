# API — days, meals, entries, leftovers, journal

See `00-conventions.md`. Scoped to the authenticated user.

## Day (Repas)

- `GET /days/:date` — the day sheet for `YYYY-MM-DD`. Lazily nothing is created
  on read; returns the existing day or an **unsaved scaffold** (meals seeded from
  template + pantry lines at qty 0) for a never-touched detailed date.
  → 200 DayDetail. Summary days return the reduced read-only shape.
- `POST /days/:date` — materialize/ensure the day_log on first write
  (creates the row + target_snapshot from that date's effective target & weight,
  `logic/day-snapshot-verdict.md`). Usually implicit via the first entry write.
- `PATCH /days/:date` — `{activity_level?(one of the 5 keys), comment?, verdict_override?(OK|NOK|null), summary_kcal?}`.
  **Upserts / auto-materializes the day** (day-model): when no row exists it is created before
  the mutation, so a comment / activity / verdict edit on a **never-touched past, present or
  future** date succeeds instead of 404-ing (it creates a `detailed` day). → 200 DayDetail
  (recomputes burn/deficit; verdict_auto recomputed). `activity_level` is never null (defaults
  to `sedentary`; DECISIONS Gap #11).
- **`summary_kcal` semantics** (day-model): the calorie total of a **summary** day; it also
  **creates or converts** to one. On a non-existent / empty (`red`) date → **creates** a summary
  (yellow) day; on an existing summary day → **updates** the total; on a `detailed` day with no
  calorie lines (Σ = 0) → **converts** it to summary (drops its empty meals). On a `detailed`
  day **with** lines (Σ > 0) the Calories cell is read-only → **409 `calories_not_editable`**
  (an accidental in-place edit stays blocked; the _deliberate_ Complet→Partiel conversion that
  discards lines goes through `POST /days/:date/summary` below, DK-1 / B-078).
  There is **no provenance distinction** — imported and self-made summary days behave identically
  (the analysis "freeze imported archives" scoping was overridden; `DECISIONS.md` Gap 3).
- Summary day: `activity_level` is **editable** like on any other day (ED-1 / B-096) — the
  former `409 summary_day_readonly` on a summary-day activity PATCH is **removed** (it blocked a
  field the user legitimately edits, e.g. on imported history). It may travel in the same PATCH
  as `summary_kcal`. Editing activity recomputes the day's `constat` (burn/deficit) on read but
  not the calorie `verdict_auto`; past days keep their **frozen** `target_snapshot` (no
  retroactive recompute, CLAUDE.md rule 4). Adding meal detail converts a summary day back to
  `detailed` (`logic/day-snapshot-verdict.md §9`).
- `POST /days/:date/detail` — **convert a summary (light) day to a detailed day** (day-model
  §9). No body. Clears `summary_kcal`, sets `kind='detailed'`, and seeds meals from the user's
  template + garde-manger pre-fill (qty 0) so the user can log lines. Idempotent on an already
  detailed day; materializes a never-touched day. → 200 DayDetail.
- `POST /days/:date/summary` — **convert a detailed (Complet) day to a summary (Partiel) day**
  (day-model §9; DK-1 / B-078). No body. Mirror of `/detail`: computes `summary_kcal := the
day's current Σ consumed kcal` **server-side**, then **drops the day's meals** (entries +
  leftovers cascade) and sets `kind='summary'`. Unlike the PATCH path this is allowed even when
  Σ > 0 — it is the deliberate, confirmed discard-the-lines conversion (the client gates it
  behind a strong confirmation, `design/components/modals.md`). Idempotent on an already summary
  day; materializes a never-touched day as summary (`summary_kcal=0`). → 200 DayDetail.
- `POST /days/:date/clear` — **clear the day** (B-046). No body. Atomically: deletes the
  day's leftover groups, deletes all non-pinned entries (custom lines + non-pinned
  referenced lines), and resets the **pinned** referenced lines (garde-manger) to qty 0 **with the
  pin's stored prefill `unit`/`portion_id`** (GM-2/B-092; not forced to `g`); **keeps** `comment`
  and `activity_level`; resets `verdict_override` to null (back to
  Auto). Pin membership is the live `pantry_item` set (`logic/pantry-pin.md`). A
  never-materialized scaffold (nothing logged) is a no-op. → 200 DayDetail. Summary day
  → 409 `summary_day_readonly`.
- `POST /days/:date/copy-from` — **replace the day with a faithful copy of another day**
  (CP-1 / B-082). Body `{from:"YYYY-MM-DD"}`. Atomically rebuilds `:date` from `from`:
  a **detailed** source copies its meals → entries (frozen macro snapshots) → leftover
  groups verbatim; a **summary** (Partiel) source makes the target a summary with the same
  `summary_kcal`. The target's existing content is dropped first (clear-then-copy, like
  `/summary`), behind a client-side strong confirmation (`design/components/modals.md`).
  **Keeps** the target's own `comment` and `activity_level`; recomputes `verdict_auto`
  against the **target's** `target_snapshot` (frozen if past, live otherwise) and resets
  `verdict_override` to null. The **garde-manger is not re-applied** — a copy reproduces the
  source exactly (a food pinned after `from` is not injected). An **empty / absent source**
  (no served line, or a summary with no kcal) → **409 `copy_source_empty`** (nothing
  written); `from == :date` or an invalid date → **422**. → 200 DayDetail.

**DayDetail** payload (detailed):

```json
{ "date","kind":"detailed","activity_level","comment",
  "verdict_auto","verdict_override","effective_verdict",
  "target_snapshot":{"cal_min","cal_max","protein_floor_g","fat_floor_g","carb_ceiling_g"},
  "totals":{"kcal","fat","carb","protein","weight_g"},
  "constat":{"estimated_burn","deficit","kg_per_week","per_level_activity_burn"},
  "meals":[ { "id","slot_name","order_index",
    "entries":[ MealEntry ], "leftover_groups":[ LeftoverGroup ],
    "totals":{...} } ] }
```

`activity_level` is always one of the 5 canonical keys (never null) here and in the
journal rows; `constat.estimated_burn`/`deficit`/`kg_per_week` are null only when the
day has no body weight yet (no weigh-in). `constat.per_level_activity_burn` is a map of the
**5 activity keys → kcal/day from activity alone** (above BMR, i.e. `BMR×multiplier − BMR`),
powering the activity-help legend (B-026); the whole map is null under the same no-weigh-in
condition as `estimated_burn`.

## Meals (this day only; never edits the template)

- `POST /days/:date/meals` — `{slot_name, order_index}` → 201.
- `PATCH /days/:date/meals/:mealId` — rename / reorder → 200.
- `DELETE /days/:date/meals/:mealId` → 204.

## Meal entries

- `POST /meals/:mealId/entries` — referenced:
  `{kind:'referenced', food_id, served_quantity, unit, portion_id?}`; custom:
  `{kind:'custom', custom_name, served_quantity?, unit?, snap:{kcal,fat,carb,
protein}}`. Both also accept an optional **`order_index`** (the line's row
  position; the UI lets the user add into any empty row, leaving blank rows above —
  see `screens/meals.md`). When omitted the entry is appended after the last row.
  Server resolves served_grams and the macro **snapshot** at write time. → 201 MealEntry.
- `PATCH /meals/:mealId/entries/order` — **reorder** a meal's lines (drag grip,
  `screens/meals.md`): `{order:[{id, order_index}, …]}`, the full new position map
  for that meal. Atomic; user-scoped (cross-tenant → 404). `order_index` may be
  sparse (preserves intentionally blank rows). Reordering changes only `order_index`
  (never consumed/totals). → 204; the client refetches the day. Any id not in this
  meal → 404 (nothing written).
- `POST /meals/:mealId/entries/:id/move` — **move** a line to another meal of the
  **same day** (desktop cross-column drag, mobile line-editor sheet — B-187/B-188):
  `{target_meal_id, order_index?}`. `order_index` omitted → appended after the
  target meal's last row. Moving changes only the line's meal and `order_index` —
  the macro **snapshot is untouched** (history stays frozen). Same-meal target →
  no-op 200. Cross-day target → 422 `validation_error`
  (`target_meal_id: 'different_day'`); a line in a **leftover group** → 422
  `validation_error` (`entry_id: 'entry_in_leftover_group'`) — nothing written;
  remove it from the group first. User-scoped (cross-tenant/unknown → 404).
  → 200 MealEntry.
- `PATCH /meals/:mealId/entries/:id` — change qty/unit/food/custom values; resets
  the snapshot for referenced foods at edit time. → 200.
- `POST /meals/:mealId/entries/:id/pin` · `/unpin` — edits the pantry_item for
  (slot_name, food_id), the live source of truth, and runs the pin/unpin cascade
  (`logic/pantry-pin.md`, B-045): **pin** adds a qty-0 line to today + future days
  lacking the food; **unpin** drops qty-0 lines for (slot, food) everywhere, keeps
  qty > 0. → 200 MealEntry.
- `DELETE /meals/:mealId/entries/:id` → 204.

**MealEntry** payload: `{id,kind,food_id?,custom_name?,served_quantity,unit,
portion_id?,served_grams,snap:{kcal,fat,carb,protein},
consumed:{grams,quantity,kcal,fat,carb,protein},is_pinned,order_index}` — `consumed` is
derived (served − leftover share; `logic/leftover-proration.md`). `consumed.quantity` is
that consumed amount expressed in the line's **own unit** (= `served_quantity ×
consumed_grams / served_grams`), so the Qté column renders what was eaten (B-047); it equals
`served_quantity` when no leftover applies. `is_pinned` is **derived live** from `pantry_item`
per read (`logic/pantry-pin.md`), not stored.

## Leftover (the plate deduction)

- `POST /meals/:mealId/leftover` — `{container_id|null, gross_grams,
entry_ids:[...]}`. Server reads the container to **freeze** its
  `container_name`+`tare_g`, validates, prorates, persists the group.
  - **409** `gross_below_tare` if gross < tare; **409** `leftover_exceeds_served`
    if net > selected served_total. Nothing written on a block
    (RECONCILIATION_LOG §E1). → 201 LeftoverGroup + updated entries.
- `PATCH /leftover/:groupId` — re-edit gross/container/selection; recomputes
  consumed (OPEN_GAPS #13). → 200. A re-edit may omit `container_id` to keep the group's
  already-frozen container (used when the original container was since deleted).
- `DELETE /leftover/:groupId` → 204 (entries revert to fully consumed).
- `POST /meals/:mealId/leftover/preview` — `{entry_ids:[...], gross_grams, tare_g}`.
  **Stateless** per-line proration for a draft leftover (B-047); persists nothing. The caller
  supplies the tare (catalog `empty_weight_g`, or a group's frozen `tare_g` on re-edit), so this
  endpoint covers create, re-edit, and a since-deleted container uniformly. The proportional
  split itself stays server-side (CLAUDE.md rule 2). → 200 `{net_grams, served_total,
lines:[{entry_id, served_grams, consumed_grams}], blocked}` where `blocked` is
  `'gross_below_tare' | 'leftover_exceeds_served' | null` (same codes the apply enforces) and
  each `consumed_grams` is clamped to ≥ 0 for display.

**LeftoverGroup** payload: `{id,container_name,tare_g,gross_grams,
leftover_net_grams,entry_ids:[...]}`.

## Journal (day history)

- `GET /journal?year=YYYY` — the full calendar **trame** for the year, newest first (day-model):
  **one row per calendar day** from `max(first record, Jan 1 of year)` to `min(today, Dec 31)`,
  with **empty (never-touched) days included as `red` rows**, **plus** any **future** day
  (> today, ≤ Dec 31) that already has a row (listed inline — author decision). Future days are
  never generated as empties.
  → 200 `{data:[{date,kcal,macros:{L,G,P}|null,verdict_auto,verdict_override,
effective_verdict,kcal_gap,burn_gap,activity_level,comment,kind,state,editable_kcal}], day_count, min_year, max_year}`.
  `kind` is `null` for an empty row; `state` is the calorie-driven colour
  (`none|green|yellow|red`, `logic/day-snapshot-verdict.md §8`); `editable_kcal` is true on any
  non-`green` day (the Calories cell creates/updates a summary day). `kcal_gap` is the **signed
  kcal écart vs the upper target** (`kcal − cal_max`, B-138), server-computed so the web never
  derives it (CLAUDE.md rule 2): it is **always relative to `cal_max`** — negative at/under the
  ceiling (including an in-band OK day, a headroom), positive when over — and is exposed on **every
  logged (`green`/`yellow`) day**; it is `null` only on a non-logged (`red`/empty/`none`) day. `burn_gap`
  is a **second, distinct** signed kcal écart — **vs the day's estimated expenditure** (`kcal −
  estimated_burn`, B-163), also server-computed (CLAUDE.md rule 2): `estimated_burn = BMR(weight on the
  day) × activity_multiplier` (the per-day deficit of `logic/day-snapshot-verdict.md §7`). Negative when
  intake is under the burn (rendered green), positive when over (red); exposed on every logged day **that
  has a weigh-in on/before its date**, and `null` otherwise (non-logged day, or no weight → no expenditure).
  Macros are null for summary
  and empty days. `day_count` is the number of **logged** days (calorie-bearing, date ≤ today) —
  distinct from the rendered row count. `min_year`/`max_year` are the global span of the user's
  day rows (across all years, independent of `year`; both `null` when none) — they bound the year
  selector (B-067). Row click resolves to `GET /days/:date`. Column sorting
  (date/calories/verdict/activity) is client-side over the returned year; there are no sort query
  params.
- Inline edits reuse `PATCH /days/:date` (verdict_override, activity_level, comment, and
  `summary_kcal` on a no-detail day — typing a total creates/updates a summary day).
