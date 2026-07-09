# Logic spec — AI advice, the coach (`advice`)

The third AI **use** (B-202): on the **Conseils** page the user presses "Générer des conseils IA";
the configured text model returns **personalised nutrition advice** as free **Markdown**, which is
**archived** (so past advices can be revisited and deleted). Depends on the connection config
(`ai-connection.md`): provider, `base_url`, `api_key`, and the task `settings.ai.tasks.advice`
(`model` + `prompt`). The endpoints are in `spec/api/ai.md`. **Blocked-by B-117/B-118** (the
connection plumbing + the dish-photo precedent it mirrors).

Unlike the other two uses, advice **persists** — each generation is stored in the `advice` table
(`spec/schema/tables-catalog.md`) with a compact **data snapshot** (§6). The call is **on demand**
(one paid model call per button press).

> Mirrors the dish-photo / meal-suggestions precedents (`ai-dish-photo-macros.md`,
> `ai-meal-suggestions.md`): a user-editable **scope** prompt + a server-assembled **structured
> context** + a hard-coded, never-stored **format instruction**. It differs in two ways: the output
> is **free Markdown** (no JSON schema → a trivial parse), and the call **archives** its result.

## 1. Inputs

- From the request (`spec/api/ai.md`): **nothing** — `POST /ai/advice` carries an empty body. The
  advice is always over the user's whole current picture; there is no per-call parameter.
- From config: `tasks.advice.prompt` (the user-editable **scope**) and `…model` (a text model; no
  vision requirement). The **default** scope (verbatim wording in `packages/shared/src/constants/ai.ts`,
  per §3 of `ai-connection.md`) carries **only the coaching tone + which data to use** — never the
  output format or language (those are appended at call time, §2).
- From `settings.locale`: the **UI language**, used for the §2 (4) language clause so the reply comes
  back in the language the user reads the app in.
- Assembled **server-side** (never from the client): the aggregated **context block** (§2.2 / §3),
  built from the user's existing figures via the read-services. The web never computes any of it
  (CLAUDE.md rule 2) — it only renders the returned Markdown.

## 2. Prompt assembly

The chat-completion request (`ai-connection.md §6b`) carries **one `user` message** whose single text
part is assembled in this order:

1. the configured `prompt` (scope, §2.1);
2. a structured **context block** (§2.2): the aggregated data sections;
3. an **avoidances clause** (§2.4, B-216) — app-owned, only present when the user has set an
   allergies / disliked-foods list; lists the foods the coach must never recommend;
4. the **hard-coded analysis instruction** (§2.3, B-212) — app-owned, never stored: assess balance
   over the average and flag deficiency _risks_ with a no-micronutrient caveat;
5. the **hard-coded format instruction** (§2.3) — app-owned, never stored;
6. a **language clause** resolved from `settings.locale` — `Respond in French.` (`fr`) or
   `Respond in English.` (`en`) — mirroring the dish-photo language clause (`ai-dish-photo-macros.md`
   §2). This is the **only** thing that sets the output language; the scope prompt says nothing about
   language, so editing the scope can never make the reply come back in the wrong language.

The configured `prompt` is **never trusted to define the output shape, analysis, or language**; the
hard-coded analysis + format instructions + the locale clause always close the text part.

### 2.1 Default scope prompt (English; user-editable in Settings)

The shipped default for `advice` (`packages/shared/src/constants/ai.ts`, `defaultTaskPrompt`):

> You are a supportive nutrition coach. Using the tracking data provided — recent intake and
> calorie/macro adherence, weight and BMI trend, current and past targets, logging regularity, and the
> recent food log — give practical, personalised advice to help the user progress toward their goals.
> Be encouraging and factual: never paternalistic, never reproachful, never guilt-inducing. Focus on
> concrete, actionable suggestions and acknowledge what is already going well.

The non-paternalistic tone is baked into the **editable** default (owner decision, B-202) so the user
can adjust it; the format (Markdown) and language (locale) are **not** here — they live in §2.3 / §2 (4)
so they hold regardless of how the user rewrites the scope.

### 2.2 Context block (assembled, not stored raw; the compact snapshot)

A compact, structured block appended after the scope prompt. It is the same object persisted as the
archive **`snapshot`** (§6). Sections (all numbers plain, SI, rounded per `00-conventions.md`):

- **Profile & engine** (`GET /profile` + `GET /target` engine): `age`, `sex`, `height_cm`,
  `current_weight_kg`, `bmr`, `estimated_burn`, `empirical_burn`, `deficit_at_target`,
  `protein_floor_g`, `fat_floor_g`, `carb_ceiling_g`, `target_bmi`.
- **Current target** (`GET /target`): `cal_min`, `cal_max`, `protein_g_per_kg`, `fat_g_per_kg`,
  `target_weight_kg`, `rate_kg_per_week`, `effective_from`.
- **Target history** (`GET /targets`, all versions): `[{ effective_from, until, cal_min, cal_max,
protein_g_per_kg, fat_g_per_kg, target_weight_kg, rate_kg_per_week }]` (newest first).
- **Weight & body** (`GET /weight?range=all`): the cartouche (`current`, `delta_prev`, `bmi`,
  `bmi_category`, `waist`, `waist_delta`, `gap_to_goal`, `projection`), the latest **EMA** and
  **trajectory** value + recent slope, and the **per-period** stats `[{ start_date, end_date, days,
weight_end, ema, delta, ecart_trajectoire, avg_intake, estimated_burn, empirical_burn,
deficit_per_day, avg_activity, diet_flag }]`.
- **Rolling intake** (`GET /stats/rolling`): `[{ window: 7|14|30|365, avg_kcal, ok_rate, vs_target }]`.
- **Adherence & regularity** (`GET /stats/adherence`, **monthly over all history**): `monthly:[{
year, month, ok_count, nok_count, nok_under_count, nok_over_count, ok_rate, avg_kcal_ok, avg_kcal_nok,
avg_kcal_global, target_zone }]` — each aggregate carries its **`year`** (B-215) so the all-history
  pivot never collapses same-numbered months across years; `key:{ year_ok_rate, overall_ok_rate, current_ok_streak,
best_month }`; `signals:[{ code, value, text }]`; `records:{ all:{high,low}, year:{high,low} }`.
- **Recent journal (30 d)** (`journal.listAllLogged`, sliced to the last 30 days): `[{ date, kcal,
fat, carb, protein, verdict, activity_level }]` (day-level).
- **Recent meals (30 d), full food-lines** (`dayReadRepo.readRange` over the last 30 days): `[{ date,
meals:[{ slot_name, lines:[{ name, quantity, unit, kcal, fat, carb, protein }] }] }]` — the
  consumed food-lines, so the coach can reason about _what_ was eaten, not just totals.

### 2.3 Hard-coded format instruction (verbatim, never stored)

```
Respond in Markdown only — no code fences, no JSON, no HTML, and no preamble about being an AI or
about the data you were given. Write directly to the person being coached: short paragraphs and
bullet lists where they help, with clear sub-headings if the advice is long. Keep a warm, respectful,
non-judgmental tone; give concrete, actionable suggestions and acknowledge what is going well. Never
scold, shame, or moralise.
```

This encodes the product decisions (B-202): **Markdown output** (rendered on the Conseils page),
**non-paternalistic delivery**, and **no meta-preamble**. The format lives here — not in the editable
scope — so it is guaranteed however the user rewrites their prompt.

Alongside it, a second **hard-coded analysis instruction** (B-212, `ADVICE_ANALYSIS_INSTRUCTION`) is
appended between the context block and the format instruction — also **app-owned, never stored**
(owner decision: **always-applied**, not baked into the editable scope, so it holds regardless of how
the user rewrites their prompt, and applies to the stored config without a "Reset to default"):

```
Assess balance over the average of the period, not meal by meal: judge whether the overall intake is
balanced and flag deficiency RISKS — both at the macro level and qualitatively from the food names
provided (for example, few omega-3 sources such as oily fish, or few vegetables and little fibre). Be
explicit that these are risk hints inferred from food names and macros, not measured deficiencies:
this app does not track micronutrients, so never claim a measured micronutrient shortfall.
```

This reasons from the **food names + macros already sent** (§2.2 `meals_30d`); it adds **no** data and
**no** micronutrient tracking. The honesty caveat is mandatory: the app measures only kcal + macros.

### 2.4 Avoidances clause (assembled, app-owned; only when the user set a list)

When the user has set an **allergies / disliked-foods** free text (`settings.ai.avoidances`,
`ai-connection.md §1`, B-216), a short app-owned clause is inserted **after the context block and
before the analysis instruction**:

```
FOODS TO AVOID (user allergies/dislikes): <the user's free text>
Never recommend, suggest, or build advice around these foods.
```

The clause is **omitted entirely** when `avoidances` is empty or whitespace-only. The same persisted
list also steers the meal-suggestions use (`ai-meal-suggestions.md §2.2`). It is a per-user
**preference**, not tracking data — it is **not** part of the archived `snapshot` (§6).

## 3. Payload assembly (pure, from read-service outputs)

The aggregator is a **service** (it fetches rows via the existing read-services / repositories, then a
**pure** domain function assembles §2.2 from their plain outputs — CLAUDE.md rule 2, no new maths):

- **30-day slice.** "Recent journal" and "Recent meals" are the days in `[today − 29, today]`
  (inclusive, oldest→newest). The slice is computed in the aggregator from the full history
  (`listAllLogged` / `readRange(userId, from, to)`); **no new read endpoint** is added.
- **Monthly aggregates over ALL history.** The adherence section is the full `GET /stats/adherence`
  monthly pivot across every logged month (not a window) — the long-term regularity picture. The
  aggregator flattens the per-year pivots into one array and **stamps each entry with its `year`**
  (B-215) as it does so, so two same-numbered months from different years stay distinct (the
  stats-screen `MonthlyStat` DTO is unchanged; the year is added only in the advice payload).
- **Missing pieces degrade gracefully.** No Target → the target/engine sections carry the available
  fields and mark the rest absent (advice still generates). Thin history → shorter journal/meals
  sections. The assembly never fabricates a figure; absent inputs are omitted, not zero-filled.

The assembled object is deterministic given the read-service outputs (the oracle in §8).

## 4. Privacy — data sent to the LLM

The configured endpoint is **user-chosen and may be external**. Advice deliberately sends **more**
than the other two uses (the user is asking for advice _about themselves_): the profile figures
(age/sex/height), the metabolic engine numbers, current + past targets, the **weight/BMI/waist
trend** and per-period intake/burn/activity, rolling averages, the monthly adherence pivot + signals +
records, the 30-day day-level journal, and the 30-day **food-lines** (food names + consumed
quantities + macros), and — when set — the user's **allergies / disliked-foods** free text (§2.4,
B-216). It **never** sends: credentials, any other user's data, free-text food/day **comments**, raw
photos, or the user's account identity beyond the anonymous figures above. This wider scope is a
Conseils-specific decision (B-202), distinct from `ai-meal-suggestions.md §5`.

## 5. Response parsing & validation (pure function)

The output is **free Markdown**, so the parse is trivial (`parseAdvice(text) → string`):

1. **Unwrap** an optional outer code fence (` ```markdown … ``` ` or ` ``` … ``` `) if the whole reply
   is fenced — models sometimes wrap the answer.
2. **Trim** surrounding whitespace.
3. **Non-empty** check: an empty or whitespace-only reply → **`ai_bad_response`**.

No structural validation, no schema — the Markdown is stored as-is and **sanitised at render time**
(the web slice; Conseils page). Whatever the model returns (headings, lists, prose) is preserved.

## 6. Archive

On success the service persists one `advice` row (`spec/schema/tables-catalog.md`):
`{ id, user_id, created_at, model, content, snapshot }` where `content` = the parsed Markdown (§5),
`model` = the invoked `tasks.advice.model`, and `snapshot` = the compact §2.2 context object (JSON).
The created row is returned to the client (`201`, `spec/api/ai.md`). `GET /ai/advice` lists rows
newest-first; `DELETE /ai/advice/:id` removes one (user-scoped). The archive travels in the IMP-1
export/import envelope (`spec/api/data-export-import.md`, `advices`).

## 7. Error codes

Reuses the connection table (`ai-connection.md §7`), identical mapping to `dish-photo-macros`:
`ai_not_configured` (no `base_url`/`api_key`, or `tasks.advice.model` is `null`), `ai_unauthorized`,
`ai_rate_limited`, `ai_unavailable`, `ai_unreachable`, `ai_bad_response` (empty/unusable reply). No new
code. `error.details.provider_message` is passed through. `DELETE` adds `not_found` (unknown / other
tenant → 404).

## 8. Worked examples (oracles)

Neutral values (no personal data).

1. **Prompt order.** `settings.locale = 'fr'`, no avoidances set → the text part = `prompt` (scope) +
   context block (§2.2) + the §2.3 **analysis instruction** + the §2.3 format instruction +
   `Respond in French.`, in that order. `locale = 'en'` → the closing clause is `Respond in English.`
   The scope prompt itself contains no language/format/analysis text. The analysis instruction always
   contains "deficiency RISKS" and "does not track micronutrients", between the data and the format
   instruction (B-212).
   1b. **Avoidances present (B-216).** `settings.ai.avoidances = 'peanuts, shellfish'` → a
   `FOODS TO AVOID (user allergies/dislikes): peanuts, shellfish` clause appears **after** the context
   block and **before** the analysis instruction. Empty/whitespace-only avoidances → no such clause.
2. **30-day slice.** History has logged days on `2026-05-01 … 2026-06-30`; "today" = `2026-06-30` →
   the journal & meals sections carry exactly `2026-06-01 … 2026-06-30` (30 days, oldest→newest);
   earlier days are excluded. A gap day (no log) simply has no entry.
3. **Monthly over all history.** Adherence has 8 logged months → the context's `monthly` array has
   **8** entries (all history), independent of the 30-day slice above. Each entry carries its `year`
   (B-215): a June-2025 and a June-2026 aggregate are two distinct entries (`{year:2025,month:6}` and
   `{year:2026,month:6}`), never collapsed into one.
4. **Food-lines assembled.** A day with meal "Déjeuner" holding lines `Poulet 150 g` (248 kcal / 3 L /
   0 G / 46 P) and `Riz 100 g` → the meals section for that date lists
   `{ slot_name:'Déjeuner', lines:[{ name:'Poulet', quantity:150, unit:'g', kcal:248, fat:3, carb:0,
protein:46 }, { name:'Riz', … }] }` (rounded per `00-conventions`).
5. **Fenced reply.** Model returns ` ```markdown\n## Bilan\n- …\n``` ` → parse strips the fence →
   stored `content` = `## Bilan\n- …`.
6. **Plain reply.** `## Bilan\n\nTu progresses bien …` → stored verbatim (trimmed).
7. **Empty reply.** `""` or only whitespace → **`ai_bad_response`** (nothing archived).
8. **No target.** The user has no current Target → the target/engine sections carry only the available
   fields (the rest marked absent); assembly still succeeds and advice generates.

> Provenance: owner decisions run #50 (`BACKLOG.md` B-202) + this session's format/language decision
> (Markdown hard-coded, language from `settings.locale`). Recorded in `DECISIONS.md` B-202.
