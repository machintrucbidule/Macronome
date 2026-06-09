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

## Meal suggestions

- `POST /ai/meal-suggestions` — propose foods+quantities to bring the day into its targets, via
  the configured `meal_suggestions` task. User-scoped; **persists nothing** (the client applies a
  chosen proposal through the normal `POST /meals/:id/entries` flow). Body:

  ```json
  {
    "date": "2026-06-09",
    "meal_ids": ["<uuid>", "<uuid>"],
    "note": "optional ≤500 chars",
    "constraints": {
      "excluded_food_ids": ["<uuid>"],
      "pinned": [
        { "food_id": "<uuid>", "meal_id": "<uuid>", "portion_id": "<uuid>|null", "grams": 171 }
      ],
      "avoid": [["<food_id>", "<food_id>"]]
    }
  }
  ```

  - `date`: ISO date of the day being filled. `meal_ids`: **≥ 1** of the day's meal ids (the
    selected meals). `note`: optional, ≤ 500 chars (same cap as the photo note). `constraints`:
    optional (refine loop); all sub-fields optional.
  - **422 `validation_error`** when `meal_ids` is empty, `date` malformed, or the day has **no
    Target** to aim at (`details: { reason: "no_target" }`).

  → **200** `{ "data": MealSuggestions }`:

  ```json
  {
    "status": "proposals",
    "remaining": {
      "cal_min": 630,
      "cal_max": 730,
      "need_protein_g": 62,
      "need_fat_g": 22,
      "carb_room_g": 80,
      "entered": { "kcal": 920, "fat": 28, "carb": 70, "protein": 78 }
    },
    "proposals": [
      {
        "id": "p1",
        "fit": "full",
        "items": [
          {
            "food_id": "<uuid>",
            "food_name": "Blanc de poulet",
            "meal_id": "<uuid>",
            "portion_id": null,
            "portion_label": null,
            "served_quantity": 180,
            "unit": "g",
            "served_grams": 180,
            "snap": { "kcal": 198, "fat": 3.6, "carb": 0, "protein": 41.4 },
            "rating": 3
          }
        ],
        "day_total": { "kcal": 1615, "fat": 54, "carb": 87, "protein": 174 },
        "targets_met": { "calorie": true, "protein": true, "fat": true, "carb": true },
        "gaps": []
      }
    ]
  }
  ```

  `day_total`, `targets_met`, and `gaps` are **computed server-side** from the chosen quantities
  (never from the model). `gaps` items: `{ "target": "protein_floor"|"fat_floor", "short_g": n }`
  or `{ "target": "calorie", "delta_kcal": n }`. Empty for a full fit.

  **`status`** discriminates the outcome: `"proposals"` (the normal case — 1–3 proposals) or
  `"on_target"` (B-124). When the day is **already within the calorie band and its protein/fat floors
  are met** (`spec/logic/meal-solver.md` §1 "Already on target"), the server **short-circuits before
  calling the model** and returns a graceful **200** with `status: "on_target"` and `proposals: []` —
  it must **not** refuse. `remaining` is still returned. Example:

  ```json
  { "status": "on_target", "remaining": { "...": "..." }, "proposals": [] }
  ```

  The architecture is the **hybrid** (`spec/logic/ai-meal-suggestions.md`,
  `spec/logic/meal-solver.md`): the LLM (chef) picks foods qualitatively and outputs **no
  quantities**; a pure deterministic solver (accountant) sets integer portion counts / 5 g-step
  grams; the service recomputes the day total in code and certifies the fit. **The "fits the
  targets" claim is never trusted from the LLM.**

  **Day-awareness (B-125/B-126/B-127).** From `date` + `meal_ids` the server also assembles, with no
  extra payload, the **foods already on the working day** (per meal, names + consumed quantities)
  into the chef context, and **removes from the candidate pool** any food whose consumed weight that
  day exceeds `DAY_REPROPOSE_THRESHOLD_G` (25 g) — so an already-eaten food is never re-proposed,
  while ≤ 25 g condiments stay proposable (`spec/logic/ai-meal-suggestions.md` §2.2/§3.1). **No
  request/response shape change.**

  **Errors:** the standard AI table (identical mapping to `dish-photo-macros`): `409
ai_not_configured` (no `base_url`/`api_key`, or `tasks.meal_suggestions.model` is null); `502
ai_unauthorized`; `429 ai_rate_limited`; `503 ai_unavailable`; `504 ai_unreachable`; `502
ai_bad_response` (no parseable/valid proposal). `error.details.provider_message` is passed
  through as for the photo task.

## Reserved (not implemented)

- `advice` — the remaining `settings.ai` task. Its `/ai/*` endpoint is **not defined yet**
  (reserved, like the generic `POST /advisor/query` in `00-conventions.md`).
