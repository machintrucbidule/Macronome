# Schema — indexes, search & integrity

See `00-overview.md`. Extensions `unaccent` + `pg_trgm` required.

## Diacritic-insensitive autocomplete
`food.normalized_name` and `recipe.normalized_name` hold `unaccent(lower(name))`,
maintained on write (generated column or trigger). Autocomplete matches on the
normalized column so "crème"≈"creme", "oeuf"≈"œuf".

Trigram indexes for fast accent-agnostic prefix/substring search:
```sql
CREATE INDEX idx_food_normname_trgm   ON food   USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_recipe_normname_trgm ON recipe USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_container_normname_trgm ON container USING gin (normalized_name gin_trgm_ops);
```
The Daily-log/recipe ingredient autocomplete queries **food ∪ recipe** (both
normalized columns); the Foods browse queries `food` only, Recipes browse
`recipe` only.

## Tenant & lookup indexes
```sql
-- scoping (every user-owned table)
CREATE INDEX idx_food_owner        ON food(owner_id) WHERE archived_at IS NULL;
CREATE INDEX idx_recipe_owner      ON recipe(owner_id) WHERE archived_at IS NULL;
CREATE INDEX idx_container_owner   ON container(owner_id);
CREATE INDEX idx_pantry_user_meal  ON pantry_item(user_id, meal_slot_name);
CREATE INDEX idx_target_user_eff   ON target(user_id, effective_from DESC);

-- day & meal traversal
CREATE UNIQUE INDEX uq_daylog_user_date ON day_log(user_id, date);
CREATE INDEX idx_daylog_user_date  ON day_log(user_id, date DESC);
CREATE INDEX idx_meal_day          ON meal(day_log_id, order_index);
CREATE INDEX idx_mealentry_meal    ON meal_entry(meal_id, order_index);
CREATE INDEX idx_leftover_meal     ON leftover_group(meal_id);

-- weight traversal (period derivation)
CREATE UNIQUE INDEX uq_weight_user_date ON weight_entry(user_id, date);
CREATE INDEX idx_weight_user_date  ON weight_entry(user_id, date ASC);

-- food uniqueness for name-resolution / duplicate warning
CREATE INDEX idx_food_owner_normname ON food(owner_id, normalized_name) WHERE archived_at IS NULL;
```

## Stats query support
Rolling windows / heatmap / pivots read `day_log(user_id, date, kind,
summary_kcal, verdict_auto, verdict_override)`; the `idx_daylog_user_date` index
covers the trailing-window and per-year scans. Detailed-day kcal totals are
derived from `meal_entry` snapshots (or cached on `day_log` if a build chooses
to denormalize — not required by the contract).

## Referential cleanup
- `food`, `recipe`, `container` are **never hard-deleted** while referenced by
  history — `food`/`recipe` use `archived_at`; `container` is freely deletable
  because `leftover_group` froze its value (no FK).
- `meal`/`meal_entry`/`leftover_group*` cascade from their `day_log`.
- `pantry_item` referencing an archived food is retained (not prefilled).
