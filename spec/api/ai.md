# API — AI uses

AI _uses_ (as opposed to the AI _connection config_ in `weight-targets-stats-settings.md`).
Each endpoint backs one configured task of `settings.ai` (`spec/logic/ai-connection.md`). See
`00-conventions.md` for auth, tenancy, and the error envelope. Base path `/api/v1`. All routes
require auth and are user-scoped (the AI config is read from the authenticated user's settings).

These calls make an **outbound request** to the user's configured OpenAI-compatible endpoint and
**persist nothing** — they return an estimate that the client uses to pre-fill a form.

## Dish photo → macro estimate

- `POST /ai/dish-photo-macros` — estimate a dish's name + totals from photos, via the configured
  `dish_photo_macros` task (vision model). Body:

  ```json
  { "images": ["data:image/jpeg;base64,…", "…"], "note": "optional precision text" }
  ```

  - `images`: **0..4** data URLs, MIME ∈ {`image/jpeg`,`image/png`,`image/webp`} (validated at the
    controller). Relies on the existing `express.json` **25 MB** body limit.
  - `note`: optional, ≤ 500 chars.
  - **At least one** of `images`/`note` must be present — an image alone, a note alone (e.g.
    "3 slices of saucisson, 2 slices of bread"), or both. Neither → `422 validation_error`.

  → **200** `{ "data": DishPhotoMacros }` where

  ```json
  { "dish_name": "…", "kcal": 620, "weight_g": 350, "fat_g": 18, "carb_g": 80, "protein_g": 24 }
  ```

  All numbers are **totals** (SI: grams, kcal), aggregated across all images into one result; the
  model always estimates every field (`spec/logic/ai-dish-photo-macros.md`).

  **Errors:** `422 validation_error` (bad body); `409 ai_not_configured` (no `base_url`/`api_key`,
  or `tasks.dish_photo_macros.model` is `null`); `502 ai_unauthorized` (upstream 401/403);
  `429 ai_rate_limited` (upstream 429 — quota/rate limit); `503 ai_unavailable` (upstream
  500/502/503/504, after a brief auto-retry); `504 ai_unreachable` (network/timeout);
  `502 ai_bad_response` (upstream body unparseable or not matching the format contract). When the
  provider returns a structured error its human message is passed through in
  `error.details.provider_message` so the UI can show the real reason.

  **Persistence:** none. The client maps the result into the Repas custom-entry form; the entry is
  saved later through the normal `POST /meals/:id/entries` (`kind:'custom'`) flow.

## Reserved (not implemented)

- `meal_suggestions`, `advice` — the other two `settings.ai` tasks. Their `/ai/*` endpoints are
  **not defined yet** (reserved, like the generic `POST /advisor/query` in `00-conventions.md`).
