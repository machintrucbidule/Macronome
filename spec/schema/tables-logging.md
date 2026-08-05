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

## pantry_item (garde-manger; OPEN_GAPS #8, B-045)

The **single live source of truth** for pins. Recurring foods auto-prefilled (qty 0) on
new days; the 📌 icon on every existing day is **derived from this table on read** (it is
not snapshotted per line — `logic/pantry-pin.md`). Same data as the Repas 📌 and the
Paramètres per-meal editor (two views). Editing it runs the pin/unpin cascades over the
user's days.
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | NOT NULL REFERENCES app_user(id) |
| meal_slot_name | text | NOT NULL (matches a template meal name) |
| food_id | uuid | NOT NULL REFERENCES food(id) |
| unit | text | NOT NULL DEFAULT 'g' — prefill unit (`g`/`ml`/`kg`/`portion`); GM-2/B-092 |
| portion_id | uuid | NULL REFERENCES food_portion(id) ON DELETE SET NULL — set iff `unit='portion'` |
| order_index | integer | NOT NULL (insertion order) |
| created_at, updated_at | timestamptz | |
| | | UNIQUE (user_id, meal_slot_name, food_id) — dedup |

An archived food's pantry_item is retained but **not** prefilled on new days.

The **prefill unit** (GM-2/B-092) is the unit a new day's qty-0 line is created with (quantity &
grams stay 0). When `unit='portion'` and `portion_id` is null (the named portion was deleted →
`ON DELETE SET NULL`), prefill falls back to `g`. See `logic/pantry-pin.md` §3.

## day_log

| column                 | type        | notes                                                                                                                                 |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                                                       |
| user_id                | uuid        | NOT NULL REFERENCES app_user(id)                                                                                                      |
| date                   | date        | NOT NULL                                                                                                                              |
| kind                   | text        | NOT NULL, CHECK IN ('detailed','summary')                                                                                             |
| summary_kcal           | numeric     | NULL — required when kind='summary', else NULL                                                                                        |
| activity_level         | text        | NOT NULL DEFAULT 'sedentary', CHECK IN (5 canonical keys) — no "unset" state (DECISIONS Gap #11)                                      |
| comment                | text        | NULL                                                                                                                                  |
| verdict_auto           | text        | NULL, CHECK IN ('OK','NOK') — computed & cached                                                                                       |
| verdict_override       | text        | NULL, CHECK IN ('OK','NOK') — null = use auto                                                                                         |
| target_snapshot        | jsonb       | NOT NULL — {cal_min,cal_max,protein_floor_g,fat_floor_g,carb_ceiling_g} in effect on this date (frozen once date<today; OPEN_GAPS #1) |
| created_at, updated_at | timestamptz |                                                                                                                                       |
|                        |             | UNIQUE (user_id, date) — one day per date                                                                                             |
|                        |             | CHECK (kind='summary' = (summary_kcal IS NOT NULL))                                                                                   |

Summary days are read-only archives (summary fields editable; no meal detail).
Estimated burn & deficit are derived (not stored).

## meal

| column                 | type        | notes                                                        |
| ---------------------- | ----------- | ------------------------------------------------------------ |
| id                     | uuid PK     |                                                              |
| day_log_id             | uuid        | NOT NULL REFERENCES day_log(id) ON DELETE CASCADE            |
| slot_name              | text        | NOT NULL (this day's own ordered slot, seeded from template) |
| order_index            | integer     | NOT NULL                                                     |
| created_at, updated_at | timestamptz |                                                              |

Per-day meal structure is independent once seeded (editing it never edits the
template). Only on detailed days.

## meal_entry

| column                 | type        | notes                                                                                              |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                    |
| meal_id                | uuid        | NOT NULL REFERENCES meal(id) ON DELETE CASCADE                                                     |
| kind                   | text        | NOT NULL, CHECK IN ('referenced','custom')                                                         |
| food_id                | uuid        | NULL REFERENCES food(id) — when kind='referenced' (incl. recipe-derived)                           |
| custom_name            | text        | NULL — when kind='custom'                                                                          |
| served_quantity        | numeric     | NOT NULL DEFAULT 0, CHECK ≥ 0 — input qty                                                          |
| unit                   | text        | NOT NULL, CHECK IN ('g','ml','kg','portion')                                                       |
| portion_id             | uuid        | NULL REFERENCES food_portion(id) — when unit='portion'                                             |
| served_grams           | numeric     | NULL — resolved grams; NULL for weightless custom                                                  |
| snap_kcal              | numeric     | NOT NULL — macro snapshot for the served quantity                                                  |
| snap_fat               | numeric     | NOT NULL                                                                                           |
| snap_carb              | numeric     | NOT NULL                                                                                           |
| snap_protein           | numeric     | NOT NULL                                                                                           |
| order_index            | integer     | NOT NULL                                                                                           |
| pinned                 | boolean     | NOT NULL DEFAULT false — this line is a garde-manger line (B-198, per-line pin; see logic)         |
| created_at, updated_at | timestamptz |                                                                                                    |
|                        |             | CHECK ((kind='referenced' AND food_id IS NOT NULL) OR (kind='custom' AND custom_name IS NOT NULL)) |

Consumed grams & scaled macros are **derived** = snapshot × consumed/served,
where consumed = served − the entry's leftover share (see logic). Snapshot
freezes history against later food/recipe edits.

## leftover_group (OPEN_GAPS #13)

| column                 | type        | notes                                            |
| ---------------------- | ----------- | ------------------------------------------------ |
| id                     | uuid PK     |                                                  |
| meal_id                | uuid        | NOT NULL REFERENCES meal(id) ON DELETE CASCADE   |
| container_name         | text        | NOT NULL — frozen value at apply time (NOT a FK) |
| tare_g                 | numeric     | NOT NULL, CHECK ≥ 0 — frozen value at apply time |
| gross_grams            | numeric     | NOT NULL, CHECK ≥ 0                              |
| created_at, updated_at | timestamptz |                                                  |

`leftover_net_grams = gross_grams − tare_g` is derived. Re-editable.

## leftover_group_entry (the prorated subset)

| column            | type | notes                                                    |
| ----------------- | ---- | -------------------------------------------------------- |
| leftover_group_id | uuid | NOT NULL REFERENCES leftover_group(id) ON DELETE CASCADE |
| meal_entry_id     | uuid | NOT NULL REFERENCES meal_entry(id) ON DELETE CASCADE     |
|                   |      | PK (leftover_group_id, meal_entry_id)                    |

An entry may belong to at most one group per meal (enforced in app); only
entries with served_grams > 0 are eligible.

## day_restore_point (undo of a destructive day action; B-261)

| column     | type        | notes                                                                  |
| ---------- | ----------- | ---------------------------------------------------------------------- |
| id         | uuid PK     |                                                                        |
| user_id    | uuid        | NOT NULL REFERENCES app_user(id) ON DELETE CASCADE                     |
| date       | date        | NOT NULL — the day the point restores                                  |
| payload    | jsonb       | NOT NULL — the day's full content just before the action               |
| action     | text        | NOT NULL — which action created it: `clear` \| `copy` \| `delete_meal` |
| created_at | timestamptz |                                                                        |
|            |             | UNIQUE (user_id, date)                                                 |

**At most one point per (user, date)**: `POST /days/:date/clear`, `POST /days/:date/copy-from`
and `DELETE /days/:date/meals/:mealId` each **overwrite** it just before writing, and
`POST /days/:date/undo` consumes and **deletes** it. Undo is therefore single-level: it returns
the day to the state immediately preceding the last destructive action, never further back.

`payload` is a **value snapshot, not a set of references**: meals, entries (with their frozen
macro snapshots and per-line pantry flags) and leftover groups (with their already-frozen
`container_name` + `tare_g`), plus the day's `kind`, `summary_kcal`, `comment`,
`activity_level` and `verdict_override`. It is the same shape the day-copy plan already uses, so
a restore replays through the same transactional rebuild. A point captured on a date that carried
no `day_log` records that absence, and restoring it removes the day again.

Nothing else may read `payload`: it is not history, not an audit trail, and never feeds stats —
`day_log` remains the sole source for every aggregate. Points do not expire; the next destructive
action on the same date is what clears the previous one.
