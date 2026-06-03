# API — weight, targets, stats, settings, pantry

See `00-conventions.md`. Scoped to the authenticated user.

## Weight
- `GET /weight?range=3m|6m|1y|all` — → 200
  `{weigh_ins:[{id,date,weight_kg,waist_cm,diet_flag,note}],
    ema:[{date,value}], trajectory:[{date,value}],
    periods:[Period], cartouche:{current,delta_prev,bmi,bmi_category,waist,
    waist_delta,gap_to_goal,projection}, current_mode}`.
  EMA/trajectory computed on full history, clipped to range
  (`logic/weight-periods-trajectory.md`).
- `POST /weight` — `{date, weight_kg, waist_cm?, diet_flag, note?}`.
  One per day: posting onto an occupied date → 409 `weigh_in_date_occupied`
  with `{existing_id}`; client confirms then `PATCH` to replace. → 201.
- `PATCH /weight/:id` — edit (incl. `date`); re-derives adjacent periods. → 200.
- `DELETE /weight/:id` → 204; re-derives adjacent periods.

**Period** payload: `{start_date,end_date,days,weight_end,ema,delta,
ecart_trajectoire,bmi,waist,avg_intake,estimated_burn,empirical_burn,
deficit_per_day,avg_activity,diet_flag,note}` — all per-day where applicable.
Single weigh-in → no periods (empty). Projection only if target_weight set and
not in Maintien mode.

## Targets & metabolic engine (Cibles)
- `GET /target` — current target + live engine readout. → 200
  `{target:{calorie_min,calorie_max,protein_g_per_kg,fat_g_per_kg,
    target_weight_kg,rate_kg_per_week,effective_from},
    engine:{age,bmr,current_weight_kg,recent_avg_activity,estimated_burn,
    empirical_burn,protein_floor_g,fat_floor_g,carb_ceiling_g,
    deficit_at_target,kg_per_week},
    warnings:[ 'carb_ceiling_non_positive'? ] }`.
  Engine values are derived (`logic/metabolic-engine.md`, `targets-macros.md`);
  carb ceiling ≤ 0 returns its **real value** + the warning, never blocks.
- `POST /target` — new target row `{calorie_min,calorie_max(≥min),
  protein_g_per_kg(≥0),fat_g_per_kg(≥0),target_weight_kg?,rate_kg_per_week?,
  effective_from}`. Saving never blocks on an inconsistent carb ceiling. → 201.
- `POST /target/suggest` — `{desired_deficit}` → 200 proposed `{calorie_min,
  calorie_max}` (never writes; client confirms then POSTs).
- `GET/PATCH /profile` — `{sex,birthdate,height_cm}` (edited on Cibles; feeds the
  engine). Age is derived, never written.

## Stats
- `GET /stats/rolling` — → 200 four windows
  `[{window:7|14|30|365,avg_kcal,ok_rate,vs_target:'in'|'above'|'below'}]`,
  always as of the latest logged day (`as_of` in the response). Window = last N
  **calendar** days; averages over logged days within; OK rate over logged days
  within (OPEN_GAPS #2, RECONCILIATION_LOG §E4).
- `GET /stats/adherence?year=YYYY` — → 200
  `{heatmap:[{date,status:'OK'|'NOK'|'none'}],
    monthly:[{month,ok_count,nok_count,ok_rate,avg_kcal_ok,avg_kcal_nok}],
    key:{year_ok_rate,overall_ok_rate,current_ok_streak,best_month},
    target_zone:{cal_min,cal_max}, signals:[{code,value,text}]}`.
  Best month: highest ok_rate among months with ≥ 5 logged days (OPEN_GAPS #12).

## Settings, template, pantry (Paramètres)
- `GET/PATCH /settings` — `{locale,theme,llm_endpoint?}` (llm_endpoint stored,
  unused in v1).
- `GET /meal-template` · `POST /meal-template` (add) ·
  `PATCH /meal-template/:id` (rename/reorder) · `DELETE /meal-template/:id`.
- `GET /pantry?meal_slot_name=` — list. `POST /pantry`
  `{meal_slot_name,food_id}` (dedup → 409 `pantry_duplicate`).
  `DELETE /pantry/:id` — unpins; affects **future** prefill only (OPEN_GAPS #8).
  The Repas pin endpoints and these are two views of the same `pantry_item` data.
