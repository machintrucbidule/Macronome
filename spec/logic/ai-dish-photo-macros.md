# Logic spec — AI dish-photo macro estimate (`dish_photo_macros`)

The first AI **use** (B-118): the user supplies one or more dish photos (and an optional note);
the configured vision model estimates the dish and its totals, which **pre-fill** the Repas
custom-entry form (the user then validates or edits — nothing is persisted by this call).
Depends on the connection config (`ai-connection.md`): provider, `base_url`, `api_key`, and the
task `settings.ai.tasks.dish_photo_macros` (`model` + `prompt`). The endpoint is in
`spec/api/ai.md`. **Blocked-by B-117** (the connection must be configured first).

## 1. Inputs

- `images` — 0..N data URLs (`data:image/<jpeg|png|webp>;base64,…`); N capped (see `spec/api/ai.md`).
- `note?` — optional short free text from the user ("précisions sur ce qui est pris en photo").
- **At least one** of `images`/`note` must be present (image alone, note alone, or both); the API
  rejects an empty request with `422`. A note-only request describes the food in words (e.g.
  "3 tranches de saucisson, 2 tranches de pain") and is estimated without any image.
- From config: `tasks.dish_photo_macros.prompt` (the user-editable **scope**) and `…model` (an
  **image-capable** model; the Paramètres picker hides generation/embedding/audio models — a
  best-effort id heuristic, since the OpenAI-compatible `/models` listing carries no capability flags).

## 2. Prompt assembly

The chat-completion request (`ai-connection.md` §6b) carries **one `user` message** with
multimodal content, assembled in this order:

1. **text part** = the configured `prompt` (scope), then — if `note` is non-empty — a blank line
   and the note, then a blank line and the **hard-coded format instruction** (§3), then a blank line
   and the **dish-name language clause** (`Write the "dish_name" in <French|English>.`) resolved from
   the **user's UI language** (`settings.locale`), so the returned name is localised (B-119). Only
   `dish_name` is localised — all numbers stay SI, unaffected.
2. **image parts** = one `image_url` part per input image, in order. **Zero images** (note-only) →
   the message carries the single text part alone (the model estimates from the description).

The configured `prompt` and the `note` are **never trusted to define the output shape** — the
hard-coded format instruction (app-owned, not stored, §3) always closes the text part so the
return format is guaranteed regardless of what the user typed.

## 3. Hard-coded response-format contract (English; lives in code, not in settings)

The app appends, verbatim:

> Respond with ONLY one JSON object, no markdown, no commentary, matching exactly:
> `{"dish_name":string,"calories_kcal":number,"weight_g":number,"fat_g":number,"carb_g":number,"protein_g":number}`.
> All numbers are **totals** for the whole dish, based on the provided photo(s) and/or written
> description, in **SI units**
> (grams for weight and macros, kcal for energy), as plain numbers (no units, no quotes). Always
> give your **best estimate for every field — never omit a field or use null**. If several dishes
> appear, **aggregate them into one result** and combine their names in `dish_name`.

This encodes two product decisions (DECISIONS B-118): **aggregate multiple dishes into one
result** and **always estimate every field** (no nulls).

## 4. Response parsing & validation (pure function)

`parseDishPhotoResult(text) → DishPhotoMacrosResult`:

1. **Unwrap** an optional markdown code fence (`/`json … ```), then take the first balanced
`{ … }` object if extra prose surrounds it.
2. `JSON.parse`.
3. **Coerce** each numeric field: accept a number, or a numeric **string** (`"160"`, comma →
   dot) → number. (Tolerant coercion — models often quote numbers.)
4. **Validate** the shape: `dish_name` non-empty string; `calories_kcal`, `weight_g`, `fat_g`,
   `carb_g`, `protein_g` all **finite and ≥ 0** after coercion.
5. **Map** to the result `{ dish_name, kcal: calories_kcal, weight_g, fat_g, carb_g, protein_g }`.

Any failure (not parseable, missing field, non-numeric, negative, `null`) → **`ai_bad_response`**.
No rounding here — the web rounds for display per `00-conventions.md`; these totals fill the
custom-entry form, which already holds raw values.

## 5. Mapping to the custom-entry form

The result maps **1:1** (the form holds **totals**, not per-100 g — `screens/meals.md` custom
inline editor): `dish_name → name`, `kcal → kcal`, `weight_g → served weight`, `fat_g/carb_g/
protein_g → fat/carb/protein`. No unit conversion. `dish_name` arrives in the **user's UI language**
(§2 language clause), so the pre-filled name reads naturally and is stored that way. The user saves
later through the normal `POST /meals/:id/entries` (`kind:'custom'`) flow — this call persists nothing.

## 6. Error codes

Reuses `ai-connection.md` §7: `ai_not_configured` (no `base_url`/`api_key`, or
`tasks.dish_photo_macros.model` is `null`), `ai_unauthorized`, `ai_unreachable`,
`ai_bad_response`. No new code.

## 7. Worked examples (oracles)

1. **Clean JSON.** `{"dish_name":"Pasta","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80,"protein_g":24}`
   → `{name:"Pasta", kcal:620, weight_g:350, fat_g:18, carb_g:80, protein_g:24}`.
2. **Fenced JSON.** the same wrapped in `json … ` → accepted (fence stripped).
3. **Quoted numbers.** `"calories_kcal":"620"` → coerced to `620`.
4. **Missing field.** no `protein_g` → **`ai_bad_response`**.
5. **Negative / NaN.** `"weight_g":-5` or `"fat_g":"abc"` → **`ai_bad_response`**.
6. **Empty name.** `"dish_name":""` → **`ai_bad_response`**.
7. **Prompt assembly.** `note` present → text part = `prompt` + note + format instruction + the
   dish-name language clause (`Write the "dish_name" in French.` for `locale:'fr'`), in that order,
   followed by the image parts; `note` empty → text part = `prompt` + format instruction + the
   language clause (`… in English.` for `locale:'en'`).
