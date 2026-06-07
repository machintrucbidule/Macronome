# Schema — catalog tables

See `00-overview.md`. Columns list type · null/not-null · constraints.

## app_user

| column                 | type        | notes                                             |
| ---------------------- | ----------- | ------------------------------------------------- | ---------------------- | ------- | ---------------------------------------------------------------------- |
| id                     | uuid PK     |                                                   |
| username               | text        | NOT NULL, UNIQUE (citext or lower() unique index) |
| password_hash          | text        | NOT NULL (argon2/bcrypt; never logged)            |
| sex                    | text        | NOT NULL, CHECK (sex IN ('male','female'))        |
| birthdate              | date        | NOT NULL, CHECK (birthdate < current_date)        |
| height_cm              | numeric     | NOT NULL, CHECK (height_cm > 0)                   |
| settings               | jsonb       | NOT NULL DEFAULT '{}' — locale ('fr'              | 'en'), theme ('system' | 'light' | 'dark', default 'dark'), llm_endpoint {url,key?} (reserved, unused v1) |
| created_at, updated_at | timestamptz |                                                   |

Profile (sex/birthdate/height) is edited on Cibles; settings on Paramètres.

## food

| column                 | type        | notes                                                                                                             |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                                   |
| owner_id               | uuid        | NOT NULL REFERENCES app_user(id) — creator                                                                        |
| name                   | text        | NOT NULL                                                                                                          |
| normalized_name        | text        | NOT NULL — unaccent+lower of name (generated/maintained); search key                                              |
| kcal_per_100g          | numeric     | NOT NULL, CHECK ≥ 0                                                                                               |
| fat_per_100g           | numeric     | NOT NULL, CHECK ≥ 0                                                                                               |
| carb_per_100g          | numeric     | NOT NULL, CHECK ≥ 0                                                                                               |
| protein_per_100g       | numeric     | NOT NULL, CHECK ≥ 0                                                                                               |
| comment                | text        | NULL                                                                                                              |
| rating                 | smallint    | NULL — null=unrated, CHECK (rating IS NULL OR rating IN (0,1,2,3))                                                |
| visibility             | text        | NOT NULL DEFAULT 'private', CHECK IN ('private','shared') — editable flag, independent of owner_id (OPEN_GAPS #6) |
| source                 | text        | NOT NULL DEFAULT 'manual', CHECK IN ('manual','recipe','imported')                                                |
| recipe_id              | uuid        | NULL REFERENCES recipe(id) — set when source='recipe' (the derived food)                                          |
| archived_at            | timestamptz | NULL — soft delete                                                                                                |
| created_at, updated_at | timestamptz |                                                                                                                   |

- Editing macros affects future logs only (history frozen via meal_entry
  snapshots).
- Name-resolution (multi-user, inert in v1): a user's own food shadows a shared
  food of the same `normalized_name` owned by another user.

## food_portion

| column                 | type        | notes                                          |
| ---------------------- | ----------- | ---------------------------------------------- |
| id                     | uuid PK     |                                                |
| food_id                | uuid        | NOT NULL REFERENCES food(id) ON DELETE CASCADE |
| label                  | text        | NOT NULL (e.g. 'œuf', 'portion')               |
| grams                  | numeric     | NOT NULL, CHECK > 0                            |
| created_at, updated_at | timestamptz |                                                |
|                        |             | UNIQUE (food_id, label)                        |

The auto "portion" of a recipe-derived food is a row here.

## recipe

| column                 | type        | notes                                                              |
| ---------------------- | ----------- | ------------------------------------------------------------------ |
| id                     | uuid PK     |                                                                    |
| owner_id               | uuid        | NOT NULL REFERENCES app_user(id)                                   |
| name                   | text        | NOT NULL                                                           |
| normalized_name        | text        | NOT NULL — search key                                              |
| instructions           | text        | NULL                                                               |
| total_batch_grams      | numeric     | NOT NULL, CHECK > 0 (default = Σ ingredient grams; overridable)    |
| servings               | integer     | NOT NULL DEFAULT 1, CHECK ≥ 1                                      |
| rating                 | smallint    | NULL — null=unrated, CHECK (rating IS NULL OR rating IN (0,1,2,3)) |
| archived_at            | timestamptz | NULL — soft delete                                                 |
| created_at, updated_at | timestamptz |                                                                    |

Per-100 g & per-portion macros are derived (see `logic/recipes-derived-food.md`),
not stored on the recipe; the derived `food` row carries the snapshot-able macros.

## recipe_ingredient

| column        | type    | notes                                                                                                                                                        |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id            | uuid PK |                                                                                                                                                              |
| recipe_id     | uuid    | NOT NULL REFERENCES recipe(id) ON DELETE CASCADE                                                                                                             |
| ref_type      | text    | NOT NULL, CHECK IN ('food','recipe')                                                                                                                         |
| ref_food_id   | uuid    | NULL REFERENCES food(id)                                                                                                                                     |
| ref_recipe_id | uuid    | NULL REFERENCES recipe(id)                                                                                                                                   |
| quantity      | numeric | NOT NULL, CHECK > 0 (resolved to grams)                                                                                                                      |
| unit          | text    | NOT NULL, CHECK IN ('g','ml','kg','portion')                                                                                                                 |
| portion_id    | uuid    | NULL REFERENCES food_portion(id) — when unit='portion'                                                                                                       |
| order_index   | integer | NOT NULL                                                                                                                                                     |
|               |         | CHECK ((ref_type='food' AND ref_food_id IS NOT NULL AND ref_recipe_id IS NULL) OR (ref_type='recipe' AND ref_recipe_id IS NOT NULL AND ref_food_id IS NULL)) |
|               |         | CHECK (ref_recipe_id <> recipe_id) — no direct self-ref; transitive cycles blocked in app logic                                                              |

## container

| column                 | type        | notes                                            |
| ---------------------- | ----------- | ------------------------------------------------ |
| id                     | uuid PK     |                                                  |
| owner_id               | uuid        | NOT NULL REFERENCES app_user(id)                 |
| name                   | text        | NOT NULL                                         |
| normalized_name        | text        | NOT NULL — search key                            |
| empty_weight_g         | numeric     | NOT NULL, CHECK ≥ 0                              |
| is_builtin             | boolean     | NOT NULL DEFAULT false — the locked "Rien" (0 g) |
| created_at, updated_at | timestamptz |                                                  |
|                        |             | UNIQUE (owner_id, normalized_name)               |

Deletable freely (no soft delete): leftover history freezes its own
container_name + tare_g, so deletion never affects history (OPEN_GAPS #13). The
built-in "Rien" cannot be edited or deleted (enforced in app + is_builtin).
