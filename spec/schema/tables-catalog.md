# Schema — catalog tables

See `00-overview.md`. Columns list type · null/not-null · constraints.

## app_user

| column                 | type        | notes                                                                                                      |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                            |
| username               | text        | NOT NULL, UNIQUE (citext or lower() unique index)                                                          |
| password_hash          | text        | NOT NULL (argon2/bcrypt; never logged)                                                                     |
| sex                    | text        | NOT NULL, CHECK (sex IN ('male','female'))                                                                 |
| birthdate              | date        | NOT NULL, CHECK (birthdate < current_date)                                                                 |
| height_cm              | numeric     | NOT NULL, CHECK (height_cm > 0)                                                                            |
| settings               | jsonb       | NOT NULL DEFAULT '{}' — UI + AI config; see **settings JSON** below                                        |
| is_admin               | boolean     | NOT NULL DEFAULT false — admin role (B-190); the upgrade migration promotes users existing at upgrade time |
| last_login_at          | timestamptz | stamped at each successful login, incl. first-run setup (B-190)                                            |
| last_seen_at           | timestamptz | stamped on authenticated activity, throttled to 1/hour (B-190)                                             |
| created_at, updated_at | timestamptz |                                                                                                            |

Profile (sex/birthdate/height) is edited on Cibles; settings on Paramètres.

## account_token

Admin-generated single-use links (B-193 invitations, B-194 password resets).
Consumption **deletes** the row (single-use); revocation deletes it too; expired
rows are purged opportunistically when the admin lists pending links. Only the
sha256 of the raw token is stored — the raw token is shown once at creation and
travels in the web URL **fragment** (never in an API path/query).

| column                 | type        | notes                                                                                                       |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                                             |
| kind                   | text        | NOT NULL, CHECK (kind IN ('invite','password_reset'))                                                       |
| token_hash             | text        | NOT NULL, UNIQUE — sha256 hex of the raw single-use token                                                   |
| is_admin               | boolean     | NOT NULL DEFAULT false — role granted by an invite (unused for resets)                                      |
| user_id                | uuid        | NULL for invites; password-reset target, REFERENCES app_user(id) ON DELETE CASCADE; CHECK coherence w/ kind |
| expires_at             | timestamptz | NOT NULL — creation + 7 days                                                                                |
| created_at, updated_at | timestamptz |                                                                                                             |

### settings JSON

The `settings` blob carries UI preferences, the AI-assistant connection config, and the
external-integration connections. Keys (all optional; service supplies defaults):

- `locale` — `'fr' | 'en'` (default `'fr'`).
- `theme` — `'system' | 'light' | 'dark'` (default `'dark'`).
- `current_mode` — `'in_diet' | 'not_in_diet' | null` (Régime/Maintien, persisted from Poids).
- `lines_desktop` — integer `5..50` (default `20`): the minimum displayed rows per meal column
  on the desktop layout (B-203; user-configurable, supersedes the fixed B-186 floor).
- `lines_mobile` — integer `5..50` (default `15`): the same minimum on the mobile layout (B-203).
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
- This config is stored and **verified** (model listing proves the link); all three AI **uses**
  are built — `dish_photo_macros` (B-118), `meal_suggestions` (B-123), and `advice` (B-202,
  archived to the `advice` table). _(Replaces the earlier inert `llm_endpoint {url,key?}`
  reservation — see `DECISIONS.md` Gap 14 / B-117.)_
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

## advice

Archived AI "Conseils" (B-202): one row per generation of the `advice` AI use
(`spec/logic/ai-advice.md`, `spec/api/ai.md`). The user generates on demand, the reply
(free Markdown) is stored with a compact snapshot of the data that produced it, and past
advices are listed newest-first and deletable per item.

| column                 | type        | notes                                                                     |
| ---------------------- | ----------- | ------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                           |
| user_id                | uuid        | NOT NULL REFERENCES app_user(id) ON DELETE CASCADE                        |
| model                  | text        | NOT NULL — the invoked `settings.ai.tasks.advice.model` id                |
| content                | text        | NOT NULL — the model's reply, free Markdown (`ai-advice.md §5`)           |
| snapshot               | jsonb       | NOT NULL — compact aggregated data that produced it (`ai-advice.md §2.2`) |
| created_at, updated_at | timestamptz |                                                                           |

Listed by `created_at DESC` on the Conseils page (`idx_advice_user_created`,
`spec/schema/indexes.md`). Included verbatim in the IMP-1 export/import envelope
(`spec/api/data-export-import.md`, `advices`). Deleting a user cascades their advices.
