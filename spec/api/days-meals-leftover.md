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
- `PATCH /days/:date` — `{activity_level?(one of the 5 keys), comment?, verdict_override?(OK|NOK|null)}`.
  → 200 DayDetail (recomputes burn/deficit; verdict_auto recomputed). `activity_level`
  is never null (defaults to `sedentary`); there is no "unset" value (DECISIONS Gap #11).
- Summary day: `PATCH` accepts only `{summary_kcal?, comment?,
verdict_override?}`; meal detail is rejected → 409 `summary_day_readonly`.

**DayDetail** payload (detailed):

```json
{ "date","kind":"detailed","activity_level","comment",
  "verdict_auto","verdict_override","effective_verdict",
  "target_snapshot":{"cal_min","cal_max","protein_floor_g","fat_floor_g","carb_ceiling_g"},
  "totals":{"kcal","fat","carb","protein","weight_g"},
  "constat":{"estimated_burn","deficit","kg_per_week"},
  "meals":[ { "id","slot_name","order_index",
    "entries":[ MealEntry ], "leftover_groups":[ LeftoverGroup ],
    "totals":{...} } ] }
```

`activity_level` is always one of the 5 canonical keys (never null) here and in the
journal rows; `constat.estimated_burn`/`deficit`/`kg_per_week` are null only when the
day has no body weight yet (no weigh-in).

## Meals (this day only; never edits the template)

- `POST /days/:date/meals` — `{slot_name, order_index}` → 201.
- `PATCH /days/:date/meals/:mealId` — rename / reorder → 200.
- `DELETE /days/:date/meals/:mealId` → 204.

## Meal entries

- `POST /meals/:mealId/entries` — referenced:
  `{kind:'referenced', food_id, served_quantity, unit, portion_id?}`; custom:
  `{kind:'custom', custom_name, served_quantity?, unit?, snap:{kcal,fat,carb,
protein}}`. Server resolves served_grams and the macro **snapshot** at write
  time. → 201 MealEntry.
- `PATCH /meals/:mealId/entries/:id` — change qty/unit/food/custom values; resets
  the snapshot for referenced foods at edit time. → 200.
- `POST /meals/:mealId/entries/:id/pin` · `/unpin` — toggles the pantry_item for
  (slot_name, food_id); affects **future** days' prefill only (OPEN_GAPS #8).
- `DELETE /meals/:mealId/entries/:id` → 204.

**MealEntry** payload: `{id,kind,food_id?,custom_name?,served_quantity,unit,
portion_id?,served_grams,snap:{kcal,fat,carb,protein},
consumed:{grams,kcal,fat,carb,protein},is_pinned,order_index}` — `consumed` is
derived (served − leftover share; `logic/leftover-proration.md`).

## Leftover (the plate deduction)

- `POST /meals/:mealId/leftover` — `{container_id|null, gross_grams,
entry_ids:[...]}`. Server reads the container to **freeze** its
  `container_name`+`tare_g`, validates, prorates, persists the group.
  - **409** `gross_below_tare` if gross < tare; **409** `leftover_exceeds_served`
    if net > selected served_total. Nothing written on a block
    (RECONCILIATION_LOG §E1). → 201 LeftoverGroup + updated entries.
- `PATCH /leftover/:groupId` — re-edit gross/container/selection; recomputes
  consumed (OPEN_GAPS #13). → 200.
- `DELETE /leftover/:groupId` → 204 (entries revert to fully consumed).

**LeftoverGroup** payload: `{id,container_name,tare_g,gross_grams,
leftover_net_grams,entry_ids:[...]}`.

## Journal (day history)

- `GET /journal?year=YYYY` — one row per day, newest first.
  → 200 `{data:[{date,kcal,macros:{L,G,P}|null,verdict_auto,verdict_override,
effective_verdict,activity_level,comment,kind}], day_count}`.
  Macros are null for summary days. Row click resolves to `GET /days/:date`.
- Inline edits reuse `PATCH /days/:date` (verdict_override, activity_level,
  comment).
