# Logic spec — AI assistant connection config

The AI assistant connects to a remote, **OpenAI-compatible** chat endpoint (the target is
Google Gemini's OpenAI-compatible API, but any compatible provider — online or local — works).
v1 covers **configuration + link verification only**: storing the connection, redacting the
secret, merging partial edits, and listing the provider's models (which doubles as the
connection test). **No AI use** (photo→macros, meal suggestions, advice) is computed in v1; the
chat/vision calls are reserved. See `00-conventions.md`; the persisted shape is in
`spec/schema/tables-catalog.md` (`settings.ai`), the endpoints in
`spec/api/weight-targets-stats-settings.md`.

## 1. The connection object

`settings.ai` is `null` until configured, else:

```
provider : "openai_compatible"            // enum; only value in v1
base_url : string                          // absolute URL of the OpenAI-compatible endpoint
api_key  : string                          // SECRET
tasks    : { dish_photo_macros, meal_suggestions, advice }
```

The three **tasks** are fixed (named, not user-addable). Each task is `{ model, prompt }`:

- `model` — the provider model id chosen for that task, or `null` when not yet picked.
  `dish_photo_macros` needs a vision-capable model; `meal_suggestions` and `advice` are text.
- `prompt` — the **user-editable scope** of the request, in **English only** (see §3).

## 2. Validation

A config is **valid** when:

- `provider` ∈ { `openai_compatible` }.
- `base_url` is an **absolute URL** (`http`/`https`; `https` recommended). A relative or
  malformed value → invalid (`base_url: invalid_url`).
- `api_key`, when present, is **non-empty** after trim. (Absence is handled by merge, §4.)
- For each task: `prompt` is a **non-empty** string (an empty/blank prompt is replaced by the
  default, §3, never stored blank); `model` is either `null` or a non-empty string.

`model` being `null` is **valid at config time** — a model is only _required_ when the
corresponding AI use is later invoked (out of v1 scope). Validation is **local** (shape/format)
and never calls the provider.

## 3. Default prompts

Pure function `defaultTaskPrompt(task) → string` — **English only**, no `locale` parameter
(the prompt is provider-facing, not UI text, so it is never translated). Used to seed a new
config and to power the per-task "Reset to default" action.

```
dish_photo_macros → "Estimate the macronutrients (protein, fat, carbs) and calories of this
                     dish. Use the photo(s) when provided; otherwise rely on the written
                     description. Identify the foods and their approximate quantities."
meal_suggestions  → "Suggest meal ideas that fit the indicated macro and calorie targets."
advice            → "Give personalized nutrition advice based on the provided tracking data
                     (recent intake, target adherence, weight trend)."
```

These are **provisional** (to be refined later) and are the only prompt text v1 ships. The
**technical response-format instructions** (output schema, SI units, constraints) are **not**
part of `prompt` and **not** stored — they are hard-coded in the app and concatenated with the
task prompt at call time (future), guaranteeing the return format regardless of the user's
scope text.

## 4. Merge semantics (partial update)

A `PATCH` carries a partial `ai`; it is **deep-merged** onto the stored config so unrelated
fields survive:

- **Top level** — `provider`/`base_url` present → replace; absent → keep.
- **`api_key`** — **absent** ⇒ keep the stored key; **`""` or `null`** ⇒ clear it; any other
  value ⇒ replace. (This is how the masked UI updates everything else without resending the
  secret.)
- **`tasks`** — merged **per task and per field**: a patch touching only
  `tasks.advice.prompt` changes neither `tasks.advice.model` nor the other two tasks.

## 5. Redaction (read side)

Pure function `redact(ai) → readAi` strips the secret before the config leaves the API:

- Remove `api_key`.
- Add `api_key_set: boolean` (true iff a non-empty key is stored).
- `provider`, `base_url`, and **all `tasks`** (models + prompts) pass through unchanged.

`null` in → `null` out. The raw `api_key` is **never** serialised to a client and **never**
logged.

## 6. Provider abstraction (OpenAI-compatible)

Two provider operations are defined: **6a list models** (B-117, the connection proof) and
**6b chat completion** (B-118, backs the AI uses).

### 6a. List models

- Request: `GET {base_url}/models` with header `Authorization: Bearer {api_key}`.
- Success (HTTP 200, OpenAI shape `{ data: [{ id }, …] }`) → the list of model ids.
- This call is the **connection proof**: a successful listing means `base_url` + `api_key`
  work; populating the model menus and verifying the link are the same action (there is no
  separate "ping"). It reads the **stored** config, so the UI **persists the edited config
  first** (a normal `/settings` PATCH) before listing — the test always reflects the on-screen
  values.

Error mapping (consumed by the API layer, codes in §7):

| Condition                                                            | Error code          |
| -------------------------------------------------------------------- | ------------------- |
| no `base_url` or no stored key                                       | `ai_not_configured` |
| upstream 401/403                                                     | `ai_unauthorized`   |
| upstream 429 (quota / rate limit)                                    | `ai_rate_limited`   |
| upstream 500/502/503/504 (after a brief auto-retry)                  | `ai_unavailable`    |
| network failure / timeout / DNS / refused (after a brief auto-retry) | `ai_unreachable`    |
| 2xx but unparseable / non-OpenAI body, or other upstream non-2xx     | `ai_bad_response`   |

Transient upstream failures (5xx + network) are **retried briefly** (a few short attempts) before
the error is raised. When the provider returns a structured error body, its human message is
surfaced to the caller in `error.details.provider_message`.

### 6b. Chat completion (text + vision)

The second provider operation — **chat completion** — backs the AI _uses_. It is **implemented**
from B-118 (the `dish_photo_macros` task; `meal_suggestions` / `advice` still pending):

- Request: `POST {base_url}/chat/completions` with header `Authorization: Bearer {api_key}` and a
  body `{ model, messages, temperature }` where `model` is the **invoked task's** model
  (`tasks.<task>.model`) and `temperature` is low (deterministic, e.g. `0`).
- `messages` is one `user` message whose `content` is **multimodal** — an ordered array mixing
  `{ "type":"text", "text": … }` parts and `{ "type":"image_url", "image_url": { "url": <data URL> } }`
  parts (OpenAI-compatible vision shape; Gemini's compatible endpoint accepts it). Text-only tasks
  use a single text part.
- Success (HTTP 200) → the assistant message **text content** (`choices[0].message.content`),
  returned raw to the calling task logic, which parses it per that task's spec (e.g.
  `ai-dish-photo-macros.md`).

Error mapping is the **same table as 6a**, with one addition: the **invoked task's `model` being
`null`** is treated as `ai_not_configured` (the link is set but the task is not). The task-specific
prompt/format assembly and response parsing live in the per-task logic specs, not here.

## 7. Error codes

`ai_not_configured`, `ai_unauthorized`, `ai_rate_limited`, `ai_unavailable`, `ai_unreachable`,
`ai_bad_response`
(`string_snake`, per `spec/api/00-conventions.md`; mirrored in `shared/errors.ts`).

## 8. Worked examples (oracles)

1. **Valid config.** `provider:'openai_compatible'`, `base_url:'https://x/v1'`, `api_key:'k'`,
   all three tasks with non-empty prompts and `model:null` → **valid**.
2. **Bad base_url.** `base_url:'not a url'` → **invalid** (`base_url: invalid_url`).
3. **Redaction.** `redact({provider, base_url, api_key:'k', tasks})` →
   `{provider, base_url, api_key_set:true, tasks}` (no `api_key`; `tasks` byte-identical).
   `redact(null)` → `null`. With an empty stored key → `api_key_set:false`.
4. **Merge keeps key.** stored `{…, api_key:'k', …}` + patch `{base_url:'https://y'}`
   (no `api_key`) → `base_url` updated, `api_key` still `'k'`.
5. **Merge clears key.** stored `{…, api_key:'k'}` + patch `{api_key:''}` → key removed
   (`api_key_set` becomes false on read).
6. **Per-task merge.** stored tasks all set + patch `{tasks:{advice:{prompt:'New scope'}}}`
   → `advice.prompt` updated; `advice.model` and the `dish_photo_macros`/`meal_suggestions`
   tasks unchanged.
7. **Default prompt.** `defaultTaskPrompt('advice')` → the English advice string in §3
   (same value for any UI locale).
