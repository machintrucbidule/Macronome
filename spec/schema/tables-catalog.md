# Schema — catalog tables

See `00-overview.md`. Columns list type · null/not-null · constraints.

## app_user

| column                 | type        | notes                                                               |
| ---------------------- | ----------- | ------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                     |
| username               | text        | NOT NULL, UNIQUE (citext or lower() unique index)                   |
| password_hash          | text        | NOT NULL (argon2/bcrypt; never logged)                              |
| sex                    | text        | NOT NULL, CHECK (sex IN ('male','female'))                          |
| birthdate              | date        | NOT NULL, CHECK (birthdate < current_date)                          |
| height_cm              | numeric     | NOT NULL, CHECK (height_cm > 0)                                     |
| settings               | jsonb       | NOT NULL DEFAULT '{}' — UI + AI config; see **settings JSON** below |
| created_at, updated_at | timestamptz |                                                                     |

Profile (sex/birthdate/height) is edited on Cibles; settings on Paramètres.

### settings JSON

The `settings` blob carries UI preferences, the AI-assistant connection config, and the
external-integration connections. Keys (all optional; service supplies defaults):

- `locale` — `'fr' | 'en'` (default `'fr'`).
- `theme` — `'system' | 'light' | 'dark'` (default `'dark'`).
- `current_mode` — `'in_diet' | 'not_in_diet' | null` (Régime/Maintien, persisted from Poids).
- `ai` — the AI-assistant connection, or `null` when never configured. Shape:

```jsonc
{
  "provider": "openai_compatible", // enum; only value in v1, extensible later
  "base_url": "https://…", // absolute URL of the OpenAI-compatible endpoint
  "api_key": "…", // SECRET — stored as-is, NEVER returned by the API, never logged
  "tasks": {
    "dish_photo_macros": { "model": "…|null", "prompt": "…" }, // photo → macro estimate (vision model)
    "meal_suggestions": { "model": "…|null", "prompt": "…" }, // meals fitting the macro/calorie targets (text model)
    "advice": { "model": "…|null", "prompt": "…" }, // personalised nutrition advice (text model)
  },
}
```

- Each task's `prompt` is the **user-editable scope** of the request, stored in **English
  only** (independent of the UI `locale`; seeded from a fixed English default — see
  `spec/logic/ai-connection.md`). The **technical response-format instructions** (expected
  schema, SI units, constraints) are **not** stored here — they are hard-coded in the app and
  appended to the prompt at call time, so the return format is guaranteed.
- `api_key` is **write-only across the API boundary**: persisted in this column but never
  serialised back to a client (the read DTO exposes `api_key_set: boolean` instead — see
  `spec/api/weight-targets-stats-settings.md`). Not encrypted at rest in v1 (self-hosted,
  single owner, private volume); the protection is non-return + non-logging. Encryption at
  rest is a possible future hardening.
- v1 stores and **verifies** this config (model listing proves the link) but performs **no AI
  use** — the `dish_photo_macros` / `meal_suggestions` / `advice` calls are not yet built.
  _(Replaces the earlier inert `llm_endpoint {url,key?}` reservation — see `DECISIONS.md`
  Gap 14 / B-117.)_
- `integrations` — the external-integration connections (B-180/B-181), or defaults to both
  connections `null`. Shape (`spec/logic/integrations-connections.md`):

```jsonc
{
  "home_assistant": {
    // or null when not configured
    "base_url": "http://…", // absolute URL of the HA instance (http allowed on LAN)
    "token": "…", // SECRET — long-lived access token; same rules as ai.api_key
    "weight_entity_id": "sensor.scale_weight", // always user-supplied, never defaulted in code
    "weight_round_decimals": 1, // int 0..3 — server-side rounding of the imported weight
  },
  "barclaude_gateway": {
    // or null when not configured
    "base_url": "http://…", // absolute URL (host+port) of the local gateway
    "api_key": "…", // SECRET — same rules as ai.api_key
  },
}
```

- `home_assistant.token` and `barclaude_gateway.api_key` follow the exact `ai.api_key`
  SECRET doctrine: **write-only across the API boundary** (read DTO exposes `token_set` /
  `api_key_set` booleans instead), never logged, not encrypted at rest in v1. Consumed
  only by the server-side proxies under `/api/v1/integrations`
  (`spec/api/integrations.md`).

## food

| column                 | type        | notes                                                                                                               |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                                     |
| owner_id               | uuid        | NOT NULL REFERENCES app_user(id) — creator                                                                          |
| name                   | text        | NOT NULL                                                                                                            |
| normalized_name        | text        | NOT NULL — unaccent+lower of name (generated/maintained); search key                                                |
| kcal_per_100g          | numeric     | NOT NULL, CHECK ≥ 0                                                                                                 |
| fat_per_100g           | numeric     | NOT NULL, CHECK ≥ 0                                                                                                 |
| carb_per_100g          | numeric     | NOT NULL, CHECK ≥ 0                                                                                                 |
| protein_per_100g       | numeric     | NOT NULL, CHECK ≥ 0                                                                                                 |
| comment                | text        | NULL                                                                                                                |
| rating                 | smallint    | NULL — null=unrated, CHECK (rating IS NULL OR rating IN (0,1,2,3))                                                  |
| visibility             | text        | NOT NULL DEFAULT 'private', CHECK IN ('private','shared') — editable flag, independent of owner_id (OPEN_GAPS #6)   |
| source                 | text        | NOT NULL DEFAULT 'manual', CHECK IN ('manual','recipe','imported')                                                  |
| recipe_id              | uuid        | NULL REFERENCES recipe(id) — set when source='recipe' (the derived food)                                            |
| ai_proposable          | boolean     | NOT NULL DEFAULT true — eligible for AI meal proposals (B-123 / feature D9; migration backfills existing rows true) |
| archived_at            | timestamptz | NULL — soft delete                                                                                                  |
| created_at, updated_at | timestamptz |                                                                                                                     |

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

| column                 | type        | notes                                                                                                                  |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                                        |
| owner_id               | uuid        | NOT NULL REFERENCES app_user(id)                                                                                       |
| name                   | text        | NOT NULL                                                                                                               |
| normalized_name        | text        | NOT NULL — search key                                                                                                  |
| instructions           | text        | NULL                                                                                                                   |
| total_batch_grams      | numeric     | NOT NULL, CHECK > 0 (default = Σ ingredient grams; overridable)                                                        |
| batch_weight_auto      | boolean     | NOT NULL DEFAULT false — true ⇒ the server keeps `total_batch_grams` = Σ ingredient grams on every save/rebuild (RW-1) |
| servings               | integer     | NOT NULL DEFAULT 1, CHECK ≥ 1                                                                                          |
| rating                 | smallint    | NULL — null=unrated, CHECK (rating IS NULL OR rating IN (0,1,2,3))                                                     |
| archived_at            | timestamptz | NULL — soft delete                                                                                                     |
| created_at, updated_at | timestamptz |                                                                                                                        |

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
