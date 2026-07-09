# Logic spec — AI meal suggestions, the chef (`meal_suggestions`)

The second AI **use** (B-123): on the Repas page a `✨ Proposition IA` popup lets the user pick
which of the day's meals to fill (+ optional precisions); the configured model proposes **3
distinct food sets** that aim to bring the **whole day** into its calorie band + macro
floors/ceiling. This file covers the **chef** half — prompt assembly, parsing/validation, the
candidate universe, and history sampling. The **accountant** (the deterministic solver that sets
quantities) and the **verifier** (the code that certifies the day total) are in
`meal-solver.md`. The endpoint is in `spec/api/ai.md`.

The hybrid (B-123 / feature decision D1): **the LLM picks foods qualitatively and outputs no
quantities; it is never trusted for arithmetic.** Depends on the connection config
(`ai-connection.md`): provider, `base_url`, `api_key`, and the task
`settings.ai.tasks.meal_suggestions` (`model` + `prompt`). **Blocked-by B-117/B-118** (the
connection plumbing + the dish-photo precedent it mirrors).

> Mirrors the dish-photo precedent (`ai-dish-photo-macros.md`,
> `packages/api/src/domain/ai-dish-photo/*`): configured scope prompt + structured context +
> hard-coded, never-stored format instruction; then a tolerant JSON parse.

## 1. Inputs

- From the request (`spec/api/ai.md`): `date`, `meal_ids` (≥ 1 selected meal), optional `note`
  (≤ 500 chars), and an optional `constraints` block (refine loop — §3.2 / `meal-solver.md` §refine).
- From config: `tasks.meal_suggestions.prompt` (the user-editable **scope**) and `…model`. No
  vision requirement (text task).
- Assembled server-side (never from the client): the **day-wide remaining** targets
  (`meal-solver.md` §remaining), the **candidate food pool** (§3 below), and an **OK-day history
  sample** (§4). If the day has **no Target** at all (no calorie band to aim at), the endpoint
  returns `422 validation_error` with `details: { reason: "no_target" }` (nothing to aim at).

## 2. Prompt assembly

The chat-completion request carries one `user` message whose single text part is assembled in
this order:

1. the configured `prompt` (scope, §2.1);
2. a structured **context block** (§2.2): remaining targets, selected meals, candidate foods,
   OK-day history sample, precisions, and the refine constraints;
3. the **hard-coded format instruction** (§2.3) — app-owned, never stored.

The configured `prompt` and the `note` are **never trusted to define the output shape**; the
hard-coded format instruction always closes the text part. **No dish-name language clause** is
appended (unlike the photo task) — the only human-facing strings are food/meal names already in
the user's data, so nothing is localised here.

### 2.1 Default scope prompt (English; user-editable in Settings)

The shipped default for `meal_suggestions` (`packages/shared/src/constants/ai.ts`,
`defaultTaskPrompt`):

> You are a meal-planning assistant for a calorie- and macro-tracked day. From the candidate foods
> provided, choose coherent, varied, meal-appropriate sets that help reach the day's remaining
> targets. Prefer better-rated foods (3 over 2 over 1); a food with no rating is acceptable and may
> be chosen freely. Favour combinations the user has eaten on past on-target days, but keep the
> proposals distinct from one another. Assign each chosen food to one of the selected meals, and for
> a food that has named portions pick exactly one of its portions. Do not output any quantities —
> quantities are computed separately. Only use foods, meals, and portions from the provided lists;
> never invent any. Honour the user's precisions and any exclusions or fixed items given. Take into
> account the foods already on the day (listed under ALREADY ON THE DAY): build proposals that
> complement them, never re-propose a food already eaten in a meaningful amount today, and make
> every proposed set internally coherent — foods that plausibly go together as one meal.

> **B-125/B-126/B-127 (AIP-1).** The day-awareness clause + the ALREADY ON THE DAY context section
> (§2.2) + the deterministic >25 g pool exclusion (§3) were added so the chef stops re-proposing
> foods already on the plate and produces internally-coherent sets. The hard no-duplication
> guarantee is the §3 pool exclusion (prompt-independent); this clause is the qualitative coherence
> guidance that also lets condiments recur.

### 2.2 Context block (assembled, not stored)

A compact, structured block appended after the scope prompt:

- **Remaining targets:** `rem_cal_min/max`, `need_protein`, `need_fat`, `carb_room` (plain numbers).
- **Selected meals:** `[{ meal_id, name }]`.
- **Candidate foods** (the pool of §3): `[{ food_id, name, kcal_100g, protein_100g, fat_100g,
carb_100g, rating, portions: [{ portion_id, label, grams }] }]`.
- **Already on the day** (`ALREADY ON THE DAY`): the foods **already entered/eaten on the working
  day**, per meal — `[{ meal_name, foods: [name × qty] }]` (names + consumed quantities only;
  referenced foods resolved by id, custom entries by their name; zero-quantity prefill lines
  skipped). Lets the chef build sets that complement the plate and not duplicate it (B-125/B-127)
  and reason about coherence (B-126). The substantial entries (> threshold, §3) are also removed
  from the candidate pool, so this section's role is awareness/coherence, not the hard guarantee.
- **OK-day history sample:** recency-ordered `[{ date_offset, meal_name, foods: [name × qty] }]`
  (names + quantities only; §4 + Privacy §5).
- **Precisions:** the free text (`note`).
- **Constraints** (refine): `excluded_food_ids`, `pinned`, `avoid`.
- **Avoidances** (`AVOID (user allergies/dislikes, free text)`): the user's persisted
  `settings.ai.avoidances` list (B-216, `ai-connection.md §1`), when set — a **best-effort**
  free-text instruction ("Never include any food matching these") appended after the context block
  and **before** the format instruction. It is **omitted** when unset/whitespace-only. This
  complements the deterministic candidate filtering (the pool already drops `rating = 0` and
  substantial same-day foods); the free-text list is a soft steer, not a hard guarantee. The same
  list also drives the advice use (`ai-advice.md §2.4`).

### 2.3 Hard-coded format instruction (verbatim, never stored)

```
Respond with ONLY one JSON object, no markdown, no commentary, matching exactly:
{"proposals":[{"items":[{"food_id":string,"meal_id":string,"portion_id":string|null}]}]}.
Return exactly 3 proposals, each distinct from the others. Every food_id, meal_id, and
portion_id MUST come from the provided lists; portion_id is null for a food without portions,
otherwise one of that food's portion ids. Do NOT include quantities or any other field.
```

## 3. Candidate universe (pure selection rule)

User-scoped foods where **`ai_proposable = true` AND `rating ≠ 0`**. This is _not_ the standard
"rating ≥ 1" filter of `00-conventions.md`: per feature decision D8-refinement, **unrated foods
are eligible** (treated as good by default). So the pool keeps `rating ∈ {null, 1, 2, 3}` and
excludes only `rating = 0` (Bof) and `ai_proposable = false`. Archived foods are excluded. The
pool is capped at `MAX_CANDIDATE_FOODS` (token budget), prioritising by rating desc then recency
of use; **the cap is logged internally, never silently presented as "all foods"**.

### 3.1 Day-used exclusion (pure rule; B-125/B-127/AIP-1)

A food **already eaten on the working day** must not be re-proposed once it is on the plate in a
meaningful amount. Sum, **per `food_id`, across all of the day's meals**, the **consumed grams**
(`consumed.grams`, falling back to `served_grams`; zero/placeholder lines contribute nothing). Any
`food_id` whose day-total consumed weight is **strictly greater than `DAY_REPROPOSE_THRESHOLD_G`
(25 g)** is **removed from the candidate pool** (deterministic — the chef therefore cannot pick it,
and the §6 parse drops it even if the model hallucinates it). Foods used in **≤ 25 g** (condiments:
oil, spices…) **stay in the pool** and may be re-proposed. Custom entries (no `food_id`) are listed
under ALREADY ON THE DAY for awareness but are never part of the exclusion (they cannot be
candidates). The exclusion is applied **after** the §3 pool is built and **on top of** any refine
`excluded_food_ids`.

Worked mini-example: chicken breast eaten 200 g today → **excluded** (200 > 25); olive oil 10 g →
**kept** (10 ≤ 25); a food eaten 15 g at lunch + 15 g at dinner → day-total 30 g → **excluded**.

## 4. OK-day history sampling (pure selection rule)

An **OK day** is a logged day whose `effective_verdict == OK` (`day-snapshot-verdict.md`). Sample
the most recent `OK_DAY_HISTORY_WINDOW_DAYS` (≈ 60) OK days, recency-ordered; from them extract the
foods + quantities per meal (**names + amounts only**). This seeds preference/combinations and,
with the `avoid` signatures, supports variety across refine iterations. When history is thin or
empty, the chef relies on the pool + ratings alone (still fully functional — D6).

## 5. Privacy — data sent to the LLM

The configured endpoint is **user-chosen and may be external** (Anthropic/OpenAI/local). The
request sends the **minimum**: food names, per-100 g macros, ratings, portion labels + grams; the
day-wide **remaining** numeric targets and entered totals (anonymous numbers); the **working day's
own** already-eaten foods (names + consumed quantities, per meal — §2.2); an OK-day history sample
(food names + quantities); the user's free-text precisions; and — when set — the user's persisted
**allergies / disliked-foods** free text (`settings.ai.avoidances`, §2.2, B-216). It **never** sends:
identity, weight or BMI history, food comments, or any date context beyond the working day.

## 6. Response parsing & validation (pure function)

Reuse the tolerant approach of `ai-dish-photo/parse.ts`: strip an optional ` ```json ` fence,
extract the first balanced `{ … }`, `JSON.parse`, then validate:

- each `item.food_id` is in the candidate pool; else **drop the item**.
- each `item.meal_id` is in the selected set; else drop the item.
- if the food has portions, `portion_id` must be one of them (a null/invalid `portion_id` for a
  portioned food **falls back to the food's first portion**). A portionless food with a non-null
  `portion_id` → **coerce to null**.
- a proposal with **no** valid items is dropped; if fewer than 3 valid proposals remain, return
  what is valid (≥ 1). If **zero** valid proposals → **`ai_bad_response`**.
- server-side **distinctness**: if two surviving proposals have an identical food-id multiset, keep
  one (de-dup) — this may reduce the count below 3 (acceptable).

## 7. Error codes

Reuses the connection table (`ai-connection.md` §7), identical mapping to `dish-photo-macros`:
`ai_not_configured` (no `base_url`/`api_key`, or `tasks.meal_suggestions.model` is `null`),
`ai_unauthorized`, `ai_rate_limited`, `ai_unavailable`, `ai_unreachable`, `ai_bad_response`. No new
code. `error.details.provider_message` is passed through.

## 8. Worked examples (oracles)

1. **Well-formed.** `{"proposals":[{"items":[{"food_id":"F1","meal_id":"M1","portion_id":null}]}]}`
   with `F1`/`M1` in the lists → one proposal, one item kept.
2. **Fenced.** the same wrapped in ` ```json … ``` ` → accepted (fence stripped).
3. **Truncated.** trailing-garbage after a balanced object → first `{ … }` extracted, parsed.
4. **Unknown id.** an item whose `food_id`/`meal_id` is not in the lists → **item dropped**;
   a proposal left empty is dropped.
5. **Portionless with portion_id.** a portionless food carrying a non-null `portion_id` →
   coerced to `null`.
6. **Zero valid.** no surviving proposal → **`ai_bad_response`**.
7. **De-dup.** two proposals with the identical food-id multiset → one kept.
8. **Day-used exclusion (§3.1).** chicken eaten 200 g today → removed from the pool; even if the
   model returns it, the §6 parse drops the item (id not in the pool). Olive oil eaten 10 g today
   stays in the pool and may be re-proposed.

> Provenance: feature design package `specifications/features/ai-meal-proposals/` — `spec.md`
> §3/§5/§7, `challenge.md` (D1, D6, D8), `decisions.md` (D8-refinement, D9). Decisions recorded in
> `DECISIONS.md` B-123.
