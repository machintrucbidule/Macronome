# Schema — weight & targets tables

See `00-overview.md`.

## weight_entry

| column                 | type        | notes                                                                                       |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                             |
| user_id                | uuid        | NOT NULL REFERENCES app_user(id)                                                            |
| date                   | date        | NOT NULL — editable                                                                         |
| weight_kg              | numeric     | NOT NULL, CHECK > 0                                                                         |
| waist_cm               | numeric     | NULL, CHECK > 0                                                                             |
| diet_flag              | text        | NOT NULL, CHECK IN ('in_diet','not_in_diet') — describes the period ENDING at this weigh-in |
| note                   | text        | NULL                                                                                        |
| created_at, updated_at | timestamptz |                                                                                             |
|                        |             | UNIQUE (user_id, date) — one weigh-in per day (re-entry replaces)                           |

- Activity is NOT here (it is per `day_log`); a period's activity = average of
  its days.
- Consecutive entries define variable-length periods; editing a date re-derives
  adjacent periods. Per-period stats (avg intake, estimated/empirical burn,
  deficit/day, EMA, trajectory, écart) are all **derived** (see logic), not
  stored.

## target

| column                 | type        | notes                                                         |
| ---------------------- | ----------- | ------------------------------------------------------------- |
| id                     | uuid PK     |                                                               |
| user_id                | uuid        | NOT NULL REFERENCES app_user(id)                              |
| calorie_min            | integer     | NOT NULL, CHECK > 0                                           |
| calorie_max            | integer     | NOT NULL, CHECK (calorie_max ≥ calorie_min)                   |
| protein_g_per_kg       | numeric     | NOT NULL, CHECK ≥ 0                                           |
| fat_g_per_kg           | numeric     | NOT NULL, CHECK ≥ 0                                           |
| target_weight_kg       | numeric     | NULL, CHECK > 0 — goal (gates projection)                     |
| rate_kg_per_week       | numeric     | NULL, CHECK ≥ 0 — desired loss rate (drives trajectory slope) |
| effective_from         | date        | NOT NULL                                                      |
| created_at, updated_at | timestamptz |                                                               |
|                        |             | UNIQUE (user_id, effective_from)                              |

- Saving new targets inserts a new row (history of targets by `effective_from`).
- Derived gram thresholds are NOT stored on `target`; they are computed on
  current weight and frozen per day in `day_log.target_snapshot`.
- The carb ceiling may be negative (inconsistent targets) — shown with a warning,
  never clamped, never blocks saving (`logic/targets-macros.md` §4).

## Current-mode (Régime/Maintien) — NOT a table

A Weight-screen UI state, defaulting to the latest period's `diet_flag`. It is
**persisted as a single value on `app_user.settings`** (`current_mode`, M7); it
affects only that screen (pre-select new-entry flag + gate projection). It
does not change targets, verdicts, or anything off the Weight screen.

## Open-period note (Régime/Maintien) — NOT a table

The **open interval** (`logic/weight-periods-trajectory.md §2.1`) has no closing weigh-in to
carry its note, so its note is persisted as a **single value on `app_user.settings`**
(`open_period_note`, string | null; same JSON column as `current_mode`, **no migration**). It
is Weight-screen-only: it fills the open row's note and pre-fills the next "+ Pesée" note; on
creating the closing weigh-in the note transfers onto that `weight_entry.note` and
`open_period_note` is **cleared** (set null). Its régime reuses `current_mode` (no separate
field).
