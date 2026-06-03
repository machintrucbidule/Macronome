# Schema — logging tables

See `00-overview.md`. The daily log, meals, entries, pantry, leftovers.

## meal_slot_template
The user's default day structure (edited in Paramètres; seeds new days).
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | NOT NULL REFERENCES app_user(id) |
| name | text | NOT NULL (e.g. 'Petit déjeuner') |
| order_index | integer | NOT NULL |
| created_at, updated_at | timestamptz | |
| | | UNIQUE (user_id, name) |

## pantry_item  (garde-manger; OPEN_GAPS #8)
Recurring foods auto-prefilled (qty 0) on new days. Same data as the Repas 📌
and the Paramètres per-meal editor.
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | NOT NULL REFERENCES app_user(id) |
| meal_slot_name | text | NOT NULL (matches a template meal name) |
| food_id | uuid | NOT NULL REFERENCES food(id) |
| order_index | integer | NOT NULL (insertion order) |
| created_at, updated_at | timestamptz | |
| | | UNIQUE (user_id, meal_slot_name, food_id) — dedup |

An archived food's pantry_item is retained but **not** prefilled on new days.

## day_log
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | NOT NULL REFERENCES app_user(id) |
| date | date | NOT NULL |
| kind | text | NOT NULL, CHECK IN ('detailed','summary') |
| summary_kcal | numeric | NULL — required when kind='summary', else NULL |
| activity_level | text | NULL, CHECK IN (5 canonical keys) |
| comment | text | NULL |
| verdict_auto | text | NULL, CHECK IN ('OK','NOK') — computed & cached |
| verdict_override | text | NULL, CHECK IN ('OK','NOK') — null = use auto |
| target_snapshot | jsonb | NOT NULL — {cal_min,cal_max,protein_floor_g,fat_floor_g,carb_ceiling_g} in effect on this date (frozen once date<today; OPEN_GAPS #1) |
| created_at, updated_at | timestamptz | |
| | | UNIQUE (user_id, date) — one day per date |
| | | CHECK (kind='summary' = (summary_kcal IS NOT NULL)) |

Summary days are read-only archives (summary fields editable; no meal detail).
Estimated burn & deficit are derived (not stored).

## meal
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| day_log_id | uuid | NOT NULL REFERENCES day_log(id) ON DELETE CASCADE |
| slot_name | text | NOT NULL (this day's own ordered slot, seeded from template) |
| order_index | integer | NOT NULL |
| created_at, updated_at | timestamptz | |

Per-day meal structure is independent once seeded (editing it never edits the
template). Only on detailed days.

## meal_entry
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| meal_id | uuid | NOT NULL REFERENCES meal(id) ON DELETE CASCADE |
| kind | text | NOT NULL, CHECK IN ('referenced','custom') |
| food_id | uuid | NULL REFERENCES food(id) — when kind='referenced' (incl. recipe-derived) |
| custom_name | text | NULL — when kind='custom' |
| served_quantity | numeric | NOT NULL DEFAULT 0, CHECK ≥ 0 — input qty |
| unit | text | NOT NULL, CHECK IN ('g','ml','kg','portion') |
| portion_id | uuid | NULL REFERENCES food_portion(id) — when unit='portion' |
| served_grams | numeric | NULL — resolved grams; NULL for weightless custom |
| snap_kcal | numeric | NOT NULL — macro snapshot for the served quantity |
| snap_fat | numeric | NOT NULL |
| snap_carb | numeric | NOT NULL |
| snap_protein | numeric | NOT NULL |
| is_pinned | boolean | NOT NULL DEFAULT false — mirrors a pantry_item |
| order_index | integer | NOT NULL |
| created_at, updated_at | timestamptz | |
| | | CHECK ((kind='referenced' AND food_id IS NOT NULL) OR (kind='custom' AND custom_name IS NOT NULL)) |

Consumed grams & scaled macros are **derived** = snapshot × consumed/served,
where consumed = served − the entry's leftover share (see logic). Snapshot
freezes history against later food/recipe edits.

## leftover_group  (OPEN_GAPS #13)
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| meal_id | uuid | NOT NULL REFERENCES meal(id) ON DELETE CASCADE |
| container_name | text | NOT NULL — frozen value at apply time (NOT a FK) |
| tare_g | numeric | NOT NULL, CHECK ≥ 0 — frozen value at apply time |
| gross_grams | numeric | NOT NULL, CHECK ≥ 0 |
| created_at, updated_at | timestamptz | |

`leftover_net_grams = gross_grams − tare_g` is derived. Re-editable.

## leftover_group_entry  (the prorated subset)
| column | type | notes |
|--------|------|-------|
| leftover_group_id | uuid | NOT NULL REFERENCES leftover_group(id) ON DELETE CASCADE |
| meal_entry_id | uuid | NOT NULL REFERENCES meal_entry(id) ON DELETE CASCADE |
| | | PK (leftover_group_id, meal_entry_id) |

An entry may belong to at most one group per meal (enforced in app); only
entries with served_grams > 0 are eligible.
