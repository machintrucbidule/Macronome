# Schema — overview & cross-cutting rules

DDL-level data contract (not an ORM/migration-tool choice). PostgreSQL.
Files: `tables-catalog.md`, `tables-logging.md`, `tables-weight-targets.md`,
`indexes.md`. All identifiers `snake_case`; tables singular.

## Conventions

- **PK:** every table has `id` `uuid` (default `gen_random_uuid()`), unless noted
  a natural composite PK.
- **Timestamps:** `created_at timestamptz NOT NULL DEFAULT now()`,
  `updated_at timestamptz NOT NULL DEFAULT now()` on every table (trigger-updated
  in implementation; the contract just requires the columns).
- **Tenant scoping:** every user-owned table carries `user_id uuid NOT NULL
REFERENCES app_user(id)`. All reads/writes are scoped by `user_id` at the query
  layer (§7). Shared-catalog rows are still owned (see Food.visibility).
- **Soft delete:** `archived_at timestamptz NULL` where stated; archived rows are
  excluded from search/lists but retained for history and restore. No hard delete
  of entities that history references.
- **Snapshots (history-freezing):** macro snapshots on `meal_entry`, the
  `target_snapshot` on `day_log`, and the frozen container value on
  `leftover_group` (`container_name`, `tare_g`) make history immutable to later
  edits.
- **Money/enum encoding:** enums as Postgres `text` + `CHECK (col IN (...))`
  (portable, readable) unless a native `ENUM` is preferred at build time.
- **Decimals:** macro/weight quantities `numeric` (exact); no float for stored
  nutrition figures. kcal stored `numeric` (snapshots may be fractional).
- **Dates:** `date` for calendar days (day_log.date, weight_entry.date);
  `timestamptz` for instants.

## Extensions required

`CREATE EXTENSION IF NOT EXISTS unaccent;`
`CREATE EXTENSION IF NOT EXISTS pg_trgm;`
Used by the diacritic-insensitive autocomplete (see `indexes.md`).

## Entity map

- Catalog: `app_user`, `food`, `food_portion`, `recipe`, `recipe_ingredient`,
  `container`.
- Reference (global, not user-owned): `food_ref` — the Ciqual catalog shipped
  with the image (`tables-catalog.md`, `spec/logic/ciqual-catalog.md`). The one
  exception to the tenant-scoping and timestamp conventions above: no `user_id`,
  no `updated_at`.
- Logging: `meal_slot_template`, `pantry_item`, `day_log`, `meal`, `meal_entry`,
  `leftover_group`, `leftover_group_entry`.
- Weight & targets: `weight_entry`, `target`.
- AI: connection config lives on `app_user.settings.ai`; `advice` stores archived
  "Conseils" outputs (B-202, `tables-catalog.md`).
