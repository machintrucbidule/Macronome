# API — weight, targets, stats, settings, pantry

See `00-conventions.md`. Scoped to the authenticated user.

## Weight

- `GET /weight?range=3m|6m|1y|all` — → 200
  `{weigh_ins:[{id,date,weight_kg,waist_cm,diet_flag,note}],
ema:[{date,value}], trajectory:[{date,value}],
periods:[Period], open_period:Period|null, cartouche:{current,delta_prev,bmi,bmi_category,waist,
waist_delta,gap_to_goal,projection}, current_mode}`.
  EMA/trajectory computed on full history, clipped to range
  (`logic/weight-periods-trajectory.md`).
  `open_period` is the synthetic **open interval** (last weigh-in → today), present **only**
  when triggered (`logic/weight-periods-trajectory.md §2.1`): a `Period` with `open:true`,
  end-weight-dependent figures `null` (weight_end, ema, delta, ecart_trajectoire, bmi, waist,
  empirical_burn), `diet_flag = current_mode`, `note = open_period_note`. Closed `periods`
  carry `open:false`.
- `POST /weight` — `{date, weight_kg, waist_cm?, diet_flag, note?}`.
  One per day: posting onto an occupied date → 409 `weigh_in_date_occupied`
  with `{existing_id}`; client confirms then `PATCH` to replace. → 201.
- `PATCH /weight/:id` — edit (incl. `date`); re-derives adjacent periods. → 200.
- `DELETE /weight/:id` → 204; re-derives adjacent periods.

**Period** payload: `{start_date,end_date,days,weight_end,ema,delta,
ecart_trajectoire,bmi,waist,avg_intake,estimated_burn,empirical_burn,
deficit_per_day,avg_activity,diet_flag,note,open}` — all per-day where applicable.
`weight_end`, `ema`, `delta` are nullable (the open interval dashes them; closed periods
always set them). `open` flags the synthetic open interval. Single weigh-in → no closed
periods (empty), but an `open_period` may still be present. Projection only if target_weight
set and not in Maintien mode.

## Targets & metabolic engine (Cibles)

- `GET /target` — current target + live engine readout. → 200
  `{target:{id,calorie_min,calorie_max,protein_g_per_kg,fat_g_per_kg,
target_weight_kg,rate_kg_per_week,effective_from},
engine:{age,bmr,current_weight_kg,recent_avg_activity,estimated_burn,
empirical_burn,protein_floor_g,fat_floor_g,carb_ceiling_g,
deficit_at_target,kg_per_week,target_bmi},
warnings:[ 'carb_ceiling_non_positive'? ] }`.
  Engine values are derived (`logic/metabolic-engine.md`, `targets-macros.md`);
  `target_bmi` is null when `target_weight_kg` is unset (`targets-macros.md §6`);
  carb ceiling ≤ 0 returns its **real value** + the warning, never blocks.
- `POST /target` — new target row `{calorie_min,calorie_max(≥min),
protein_g_per_kg(≥0),fat_g_per_kg(≥0),target_weight_kg?,rate_kg_per_week?,
effective_from}`. Saving never blocks on an inconsistent carb ceiling. → 201.
- `POST /target/preview` — **stateless** live recompute for the Cibles form (an
  unsaved draft; mirrors `POST /recipes/preview`). Body = the target body with an
  **optional `effective_from`**: `{calorie_min,calorie_max(≥min),protein_g_per_kg(≥0),
fat_g_per_kg(≥0),target_weight_kg?,rate_kg_per_week?,effective_from?}`. Reads the
  persisted profile + weigh-in and returns the engine readout **without persisting
  anything** (no row written). With `effective_from` the engine is computed **as of that
  date** (weight, age and the recent-activity window resolved on that date) — used by the
  history editor so a past version's panel reflects its period; absent → as of today.
  → 200 `{engine:{…,target_bmi}, warnings}`.
- `POST /target/suggest` — `{desired_deficit}` → 200 proposed `{calorie_min,
calorie_max}` (never writes; client confirms then POSTs).

**Target history (TH-1).** Targets are versioned by `effective_from` (one row per date,
`UNIQUE(user_id, effective_from)`). The plural `/targets` resource manages the history.

- `GET /targets` — all versions, **newest `effective_from` first**. → 200
  `{versions:[{id,calorie_min,calorie_max,protein_g_per_kg,fat_g_per_kg,
target_weight_kg,rate_kg_per_week,effective_from,until}]}`. `until` = the day before the
  next (newer) version's `effective_from`; `null` for the current version.
- `PATCH /targets/:id` — edit a version; all fields optional, **including `effective_from`**
  (back-datable). The merged row must keep `calorie_max ≥ calorie_min` (else 422). Moving
  onto another version's date → 409 `target_date_occupied` `{existing_id}`. Absent /
  another tenant's → 404. → 200 the updated version (with its recomputed `until`).
- `DELETE /targets/:id` → 204; 404 when absent / another tenant's. (Deleting the earliest
  version shifts the retroactive-earliest fallback — `logic/day-snapshot-verdict.md §2`.)
- `POST /targets/:id/recompute` — **opt-in, auto-only** re-freeze of the version's window
  (`logic/day-snapshot-verdict.md §3`). Optional body `{from?,to?}` widens the window to a
  union span (an `effective_from` edit). Re-freezes `target_snapshot` + recomputes
  `verdict_auto` **only for logged days with `verdict_override IS NULL`** in the window;
  forced/overridden and out-of-window days are untouched. → 200 `{recomputed:number}`;
  404 when absent.
- `GET /targets/:id/recompute-count` — how many days the recompute would touch (button
  label). → 200 `{count:number}`; 404 when absent.

- `GET/PATCH /profile` — `{sex,birthdate,height_cm}` (edited on Cibles; feeds the
  engine). Age is derived, never written.

## Stats

- `GET /stats/rolling` — → 200 four windows
  `[{window:7|14|30|365,avg_kcal,ok_rate,vs_target:'in'|'above'|'below'}]`,
  always as of the latest logged day (`as_of` in the response). Window = last N
  **calendar** days; averages over logged days within; OK rate over logged days
  within (OPEN_GAPS #2, RECONCILIATION_LOG §E4). `vs_target` is the average's position vs the
  **window's own** target — the mean of the per-day frozen bands over the window, not the current
  band — so long windows are not falsely alarmist when the target changed (B-100; field shape
  unchanged). `null` when no logged day in the window carried a band.
- `GET /stats/adherence?year=YYYY` — → 200
  `{heatmap:[{date,status:'OK'|'NOK_under'|'NOK_over'|'none',kcal:number|null}],
monthly:[{month,ok_count,nok_count,nok_under_count,nok_over_count,ok_rate,avg_kcal_ok,avg_kcal_nok,avg_kcal_global,target_zone:{cal_min,cal_max}|null}],
key:{year_ok_rate,overall_ok_rate,current_ok_streak,best_month},
target_zone:{cal_min,cal_max}, signals:[{code,value,text}],
records:{all:{high,low}, year:{high,low}}}`.
  Heatmap `status` splits NOK by the day's expenditure (B-167): `NOK_under` = a real deficit
  (`day_kcal ≤ estimated_burn`, orange), `NOK_over` = surplus **or** unknown burn (red); the
  binary verdict is unchanged. Monthly `nok_under_count` + `nok_over_count` split `nok_count`
  the same way (`nok_under_count + nok_over_count = nok_count`; `ok_count` unchanged). The
  `estimated_burn` is the day's own BMR(weight in effect) × activity_multiplier (per-day basis,
  `spec/logic/stats-adherence.md §3–4`).
  Best month: highest ok_rate among months with ≥ 5 logged days (OPEN_GAPS #12).
  Monthly `avg_kcal_global` = mean kcal over all logged days of the month (OK + NOK),
  never null — feeds the avg-kcal chart's global-average polyline
  (`spec/logic/stats-adherence.md` §5).
  Monthly `target_zone` = the calorie band shaded behind that month's bars, resolved from
  the Target in effect on the month's end date (CZ-1/B-141; earliest target as the
  retroactive fallback, B-090), `null` when no Target exists — so the band steps per month
  across target changes (`spec/logic/stats-adherence.md` §5). The top-level `target_zone`
  stays the band in effect **today** (rolling cards / signals), unchanged.
  Heatmap `kcal` = that day's calorie value for logged cells, `null` when
  `status:'none'` (not logged) — feeds the cell tooltip `(date · status · kcal)`
  per `specifications/screens/stats.md`.
  `records` = **weight records** (B-197): `all` = highest/lowest weigh-in over **all** the
  user's data, `year` = highest/lowest of the **selected** `year`. Each of `high`/`low` is
  `{weight_kg:number, date:'YYYY-MM-DD'} | null` (`null` when the scope has no weigh-in). On a
  tie (the record weight reached on several days) the **most-recent** date is returned
  (`spec/logic/stats-adherence.md §9`). Computed server-side from `weight_entry`.

## Settings, template, pantry (Paramètres)

- `GET/PATCH /settings` —
  `{locale, theme, current_mode?, open_period_note?, lines_desktop?, lines_mobile?, ai?, integrations?}`.
  - **`open_period_note`** (string | null) — the Weight open-interval note
    (`logic/weight-periods-trajectory.md §2.1`, `schema/tables-weight-targets.md`); persisted
    on `app_user.settings`, patchable, nullable (cleared on the closing weigh-in).
  - **`lines_desktop`** / **`lines_mobile`** (integer, `5..50`; defaults `20` / `15`) — the
    minimum displayed rows per meal column on each layout (B-203; user-configurable, supersedes
    the fixed B-186 18/15). Out-of-range → 422. Always present on read.
  - **`ai`** is the AI-assistant connection (or `null`); see `spec/logic/ai-connection.md`
    and `spec/schema/tables-catalog.md`. On **read**, `ai` is **redacted**: the
    `api_key` is **never** returned; instead the object carries `api_key_set: boolean`.
    Read shape:
    ```json
    {
      "provider": "openai_compatible",
      "base_url": "https://…",
      "api_key_set": true,
      "tasks": {
        "dish_photo_macros": { "model": "…|null", "prompt": "…" },
        "meal_suggestions": { "model": "…|null", "prompt": "…" },
        "advice": { "model": "…|null", "prompt": "…" }
      }
    }
    ```
  - On **`PATCH`**, `ai` is a **partial** object merged onto the stored config (deep
    per-task merge; `api_key` absent = keep, `""`/`null` = clear, else replace — see
    `ai-connection.md` §4). Validation is **local** (format only; Zod at the controller);
    **no provider call** happens here. Bad URL → 422 (`base_url: invalid_url`).
  - **`integrations`** is the external-integration connections object (Home Assistant +
    BarclaudeGateway, B-180/B-181) — always present on read (both keys, `null` when not
    configured), **redacted** (`token_set` / `api_key_set` instead of the secrets), and
    patched per connection with the same secret keep/clear semantics as `ai`. Full
    read/patch shapes and the proxy endpoints: `spec/api/integrations.md`; logic:
    `spec/logic/integrations-connections.md`.
- `GET /settings/ai/models` — server-side proxy that lists the configured provider's models
  via the **stored** `ai` config (`GET {base_url}/models`, Bearer `api_key`). → 200
  `{data:[{id}]}`. **This is the connection proof** (it both populates the model menus and
  verifies the link — there is no separate test/ping endpoint). Errors:
  `ai_not_configured` (no base_url/key), `ai_unauthorized` (401/403 upstream),
  `ai_unreachable` (network/timeout), `ai_bad_response` (unparseable/other upstream error).
- **Data management** (the Paramètres "Données" section — export / wipe / import) lives under
  `/api/v1/data`; see `data-export-import.md` (IMP-1).
- `GET /meal-template` · `POST /meal-template` (add) ·
  `PATCH /meal-template/:id` (rename/reorder) · `DELETE /meal-template/:id`.
- `GET /pantry?meal_slot_name=` — list (each item carries `unit` + `portion_id`). `POST /pantry`
  `{meal_slot_name,food_id,unit?,portion_id?}` (dedup → 409 `pantry_duplicate`) — pins and runs the
  **add cascade** (qty-0 line on today + future days lacking the food; `logic/pantry-pin.md`,
  B-045). `unit` defaults to `g`; a `unit='portion'` whose `portion_id` is not one of the food's
  named portions → 422 (`portion_id: invalid_portion`). The prefilled qty-0 line carries the stored
  `unit`/`portion_id` (GM-2/B-092). `PATCH /pantry/:id` `{unit,portion_id}` — change a pin's prefill
  unit; persists then runs the **unit cascade** over today + future qty-0 placeholder lines
  (past + qty>0 lines untouched; `logic/pantry-pin.md` §3, GM-2/B-094). `DELETE /pantry/:id` —
  unpins and runs the **delete cascade** (drops qty-0 lines for (slot, food) everywhere, keeps
  qty > 0). The Repas pin endpoints and these are two views of the same live `pantry_item` data;
  pinning from a day captures **that line's** `unit`/`portion_id` onto the new pin, and editing a
  pinned line's unit re-syncs the pin + cascades (GM-2/B-093, `logic/pantry-pin.md` §3).
