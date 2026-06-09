# DECISIONS

Resolutions of `specifications/OPEN_GAPS.md`, decided by the author during the
detailed-spec phase. Each entry: the decision and its rationale. Rule-changing
decisions are also folded into `specifications/masterplan.md` / the relevant `specifications/screens/*.md`.

Convention: "Gap N" refers to the numbered point in `specifications/OPEN_GAPS.md`.

---

## Gap 1 — Day target reference & snapshot timing (DOMAIN) — RESOLVED

A past day is always fully editable, exactly like the current day; every
dependent figure recomputes afterwards. The reference _targets_ a day is judged
against are pinned to that day's own date, not to today.

- **1a — Calorie target of a past day:** the target **in effect on that date**
  (the `Target` row whose `effective_from` is the latest one ≤ the day). Changing
  today's calorie target never rewrites past verdicts. _(Author: A.)_
- **1b — Protein/fat floors of a past day:** computed on the **body weight in
  effect on that date** (the most recent weigh-in dated ≤ the day). These floors
  are display-only — they never enter the OK/NOK verdict, which is calorie-only.
  _(Author: A.)_
- **1c — Freeze timing:** while a day's date == today it tracks live edits
  (changing the target or weighing in updates the day); once date < today the
  day's snapshot is frozen and later target/weigh-in changes never alter it.
  Re-opening a past day to enter data uses the values of that day's own date.
  _(Author: A.)_

**Rationale:** keeps the OK/NOK history stable and interpretable (one target
change can't repaint months of verdicts or distort the Stats OK-rate), while
honouring "edit the past as freely as today". Since the auto verdict is
calorie-only, the only verdict-bearing snapshot field is the calorie min/max;
the macro-gram thresholds are stored solely to render a past day's macro tiles
faithfully.

**Schema/spec impact:** a `DayLog` is created lazily on first interaction with a
date (no row for never-touched days). Its `target_snapshot` (calorie min/max +
protein/fat/carb gram thresholds) is resolved from that date's effective target
and that date's current weight; recomputed while the date is today, frozen
once the date is in the past.

---

## Gap 3 — Summary vs detailed days at migration (ETL-only) — RESOLVED

Clarified fact: the workbook holds full meal detail only for the current day
(sometimes the previous day too), not ~2 weeks.

- **3a:** all imported history arrives as **summary** days (total calories +
  OK/NOK + comment, read-only archive). **No detailed day is imported at all** —
  detailed days are created exclusively in the app from go-live onward. _(Author.)_
- **3c:** import **only genuinely filled days** (those with a calorie total), up
  to the present. Future pre-traced rows and empty rows in `Archive cal`, and the
  forward-projected rows in `Suivi`, are skipped. _(Author: A.)_

**Scope note (author-raised, accepted):** the migration _cutoff date_ and
_duplicate-date resolution_ are ETL-script runtime details, not app-design
decisions, and do not affect the schema or runtime logic. They are pinned in
`spec/logic/migration-etl.md` without further arbitration; the only schema-level
fact is the already-settled `DayLog.kind ∈ {summary, detailed}` with summary
days read-only and calorie-only.

**Amendment (day-model, 2026-06-07) — summary days are creatable & freely
convertible in-app; imported days are NOT frozen.** The "every day must be usable"
change (`specifications/analysis/day-model.md`) extends this gap, and the author
**overrode** that document's "freeze imported archives" scoping:

- Summary ("light") days are no longer import-only. The user can **create** one in-app
  by typing a calorie total (no meal breakdown) — primarily from the Journal Calories
  cell. Every summary day is **editable** and freely **convertible** light⟷detailed.
- **Imported days are treated like any other data — no freeze, no provenance marker.**
  The author rejected the document's frozen-archive scoping (and therefore the
  `imported_at` provenance column it proposed): imported summary days behave exactly
  like self-made ones. _(Author, 2026-06-07: "l'import excel ne doit pas être gelé, il
  doit être géré comme n'importe quelle autre donnée".)_ The earlier-3a "read-only
  archive" wording is superseded for runtime behaviour; 3a/3c still govern **what** the
  ETL imports (summary, only filled days).

---

## Gap 4 — (nb)/(poids) merge at migration (ETL-only) — DEFAULTED

Pinned in `spec/logic/migration-etl.md`; not author-arbitrated (ETL runtime,
no schema impact: target shape is the already-settled Food + named-portion model).
Workbook-grounded rules:

- Clean (nb)+(poids) pairs → one Food: per-100 g macros = the (poids) row; one
  named portion with grams = `kcal(nb) ÷ kcal(poids)`. Illustrative: `Item A` 35 g,
  `Item B` 43.5 g, `Item C` 50 g (the ratio is the source of truth).
- When an embedded suffix carries grams ("(nb/35g)") use it; it equals
  the ratio (cross-check only).
- "(nb)"-only orphans (e.g. broths/drinks logged by unit count only) → no
  per-100 g basis → no auto-merge → manual-review list.
- "(poids)"-only orphans: "cf recette" rows → manual review (attach to recipe);
  plain rows → import as a plain food, no portion.
- Suffix-less foods → imported as-is, one food each. "Avis" → Top3/Ok2/
  Moyen1/Bof0/(N-A & blank)→unrated.
- Manual-review list = a table (name, reason, suggested action); no ambiguous
  auto-merge.
- Real workbook row inventory/counts are validated by the local-only migration
  tests against the git-ignored `suivi_poids.xlsx`, not pinned here.

---

## Gap 2 — Rolling-window definition (DOMAIN) — RESOLVED

- **2a:** a window of N = the **last N calendar days** ending at the latest
  logged day; the average is over the **logged days inside** that span (a 7-day
  average of a week with 5 logged days = mean of those 5). Not "the last N logged
  days". _(Author: A.)_

**Rationale:** an "N-day average" must denote a real wall-clock span (matches the
workbook and human reading); the logged-days variant would let a "7-day" figure
silently cover three weeks under sparse logging. Consistent with the settled
OK-rate rule (denominator = logged days within the same calendar window).

---

## Gap 6 — Private/shared visibility in v1 (DOMAIN) — RESOLVED

- **6a:** migrated foods populate the **shared common catalog**
  (`visibility = shared`); foods the user creates by hand default to
  **private**. _(Author: B.)_
- **6b:** the private/shared tag is **shown and editable** in v1 (keep the tag,
  the filter, and the visibility toggle on the Foods screen). _(Author: C.)_

**Modeling resolution (author-confirmed by default):** `Food.visibility`
(`private | shared`) is an editable flag, **independent of `Food.owner_id`**
(which records the creator and is always set). The "shared common catalog" = rows
with `visibility = shared`. Name-resolution rule: for a given user, a food they
own with the same normalized name **shadows** a shared food owned by someone else;
implemented but with no observable effect while there is a single user.

**Spec impact:** Foods screen keeps the visibility chip, the visibility filter,
and the modal toggle for v1 (reverses the "hide in v1" leaning of the gap note).
New-food default = private; migration default = shared.

---

## Gap 13 — Soft-deleted container referenced by history (DOMAIN) — RESOLVED

- **13:** the leftover deduction is **re-editable**, not one-shot. Each
  `MealEntry` keeps its **served** quantity; **consumed = served − this entry's
  share of the net leftover** is derived, so a past day's leftover can be
  reopened and adjusted like anything else (consistent with Gap 1: edit the past
  freely). _(Author: B.)_

**Container-history resolution:** the `LeftoverGroup` **freezes the container as a
value** at apply time — it stores `container_name` + `tare_g` (a snapshot),
**not a live FK** to the `Container` row. Deleting/editing a container therefore
**never** touches historical leftovers. Gap #13 is dissolved: there is no live
container reference in history to protect, and container deletion needs no
blocking or soft-delete-for-history rule (containers may be deleted freely; the
built-in "Rien" stays locked).

**Schema impact:** `LeftoverGroup` persists (`meal_id`, `container_name`,
`tare_g`, `gross_grams`, derived `leftover_net_grams`, linked selected
`MealEntry`s). `MealEntry.served_quantity` is stored; consumed + scaled macros
are derived from served and the entry's leftover share.

---

## Gap 5 — "Deficit at target" reference intake (DOMAIN) — RESOLVED

- **5:** the reference intake for the Cibles "déficit à la cible" constat is the
  **midpoint of the calorie range** `(calorie_min + calorie_max)/2`. _(Author: A.)_

**Rationale:** neutral centre of the piloted range; max/min would bias the
constat; a separate user-set figure adds a field for a purely informational
number. Confirms G7.

---

# Domain-logic gaps (#1–6, #13): ALL RESOLVED.

# UX/implementation gaps (#7–12, #14): batched below.

---

## Gaps 7–12, 14 — UX / implementation (batch) — RESOLVED (author: ok)

- **7 — Unrated rendering:** unrated → em-dash "—" with **no star widget**;
  Bof/0 → the 3-star widget showing 0 filled. The two are visually distinct (a
  dash vs. an empty-star control). Picker offers a "non noté" action that clears
  to the dash.
- **8 — Pantry editor (Paramètres):** (a) pantry foods within a meal ordered by
  insertion order; (b) no duplicate — a food already pinned on a meal cannot be
  re-added (pin keyed per `(meal_slot_name, food_id)`); (c) **the `pantry_item` list
  is the single live source of truth** — the 📌 icon on every day (past/present/future)
  is **derived from it on read**, not a per-day snapshot. The Paramètres editor and the
  Repas 📌 are two views of the same data and update everywhere instantly.
  **REVISED by B-045 (was: "unpin affects future-day pre-fill only; past lines
  untouched" — that frozen-snapshot model caused the same food to show pinned on one day
  and not another).** New cascades (`spec/logic/pantry-pin.md`): **pin** adds a qty-0
  referenced line to existing days with `date >= today` that lack the food (Option C —
  _today + future_; past history untouched), and future uncreated days prefill at
  creation; **unpin** removes every qty-0 referenced line for `(slot, food)` across all
  days, **keeps** lines with qty > 0 (they simply lose the derived icon), and stops
  future prefill. The `meal_entry.is_pinned` column is **dropped** (the flag is derived).
- **9 — EMA factor:** α = 0.35 kept as the documented default, implemented as a
  named constant (trivially tunable); fine calibration is a post-load step,
  outside the spec. Pinned details: the EMA runs **over the weigh-in series**
  (each weigh-in is one point, no daily resampling) and is **seeded at the first
  weigh-in's real weight** (same anchor as the trajectory).
- **10 — Sort-by-portion:** the Portion column is **display-only, not sortable**.
  Sortable columns: Nom, kcal, L, G, P, Note, Visib.
- **11 — Activity descriptions:** workbook FR descriptions adopted (typos
  "Modérement/Extrêment" corrected to the canonical "Modérément/Extrêmement"),
  plus EN translations. Both live in the i18n tables. (Full strings in
  `spec/logic/metabolic-engine.md` reference data.)
- **12 — "Best month" threshold:** a month needs **≥ 5 logged days** to qualify
  for "best month"; named constant.
- **14 — AI advisor hook:** originally named but inert in two places — (a) data: a
  `User.settings.llm_endpoint` config; (b) API: a reserved `POST /advisor/query` route
  "not implemented in v1". **Amended by B-117 (post-v1 triage):** the **connection** is no
  longer inert — `settings.llm_endpoint` is replaced by a richer `settings.ai`
  (OpenAI-compatible URL + secret key + three task `{model,prompt}` slots) that the user
  **configures and verifies** (model listing) on Paramètres. The **uses** (advisor/query,
  photo→macros, meal suggestions, advice) stay **reserved/501** — no AI call is built yet.
  See the B-117 entry below.

---

# Build-plan decisions (not OPEN_GAPS gaps)

## First-run wizard + Excel migration moved out of the dev plan — RESOLVED (author)

Decided during the build (not from `OPEN_GAPS.md`); recorded here because it amends
a fixed contract and reshapes the milestone plan.

- **First-run bootstrap → web wizard.** On a fresh install (no user yet) the single
  owner account is created by a one-shot, **zero-user-gated setup wizard**
  (`POST /api/v1/auth/setup`, disabled the instant the owner exists); the `create-user`
  CLI stays as an admin fallback. Built in **M8** (the milestone repurposed from "Excel
  ETL" to "First-run & usability"). _(Author.)_
- **Authorized contract amendment.** The author **explicitly authorized** amending the
  fixed contract `spec/api/00-conventions.md`: "No public sign-up in v1" → "no
  _open/public_ sign-up; account creation is limited to the one-shot, zero-user-gated
  first-run setup". The gated/one-shot wizard is **not** open public registration, so
  the spirit of contract §7 (no open registration, single owner) is preserved.
  `security.md` §1 and `ops.md` §7 updated to match. _(Author authorization.)_
- **Excel migration is out of the dev plan (O1).** The one-shot Excel→DB import of the
  personal workbook is **not** a build milestone, carries **no `M` number**, and is
  **not** required for v1. It is run at the author's discretion once the app is mature,
  and is now performed through the in-app **Settings → import** (the IMP-1 export/import
  envelope), loading an extract prepared per the **unchanged** logic contract
  `spec/logic/migration-etl.md` (the former standalone ETL plan was removed). It is **no
  longer** a first-user bootstrap path (that role is now M8's wizard). _(Author.)_

**Rationale:** the app must be genuinely usable after M10 without importing Excel data —
a real login + a first-run account creation + usable empty screens deliver that. The
historical import is decoupled so it can wait until the app is bug-free, targeting a
stable schema.

---

## B-019 — Macro-gram display rounding split — RESOLVED (author)

Post-v1 backlog triage. The macro-gram display rule in `spec/logic/00-conventions.md`
§Rounding was a single "macro grams: 1 decimal". The author chose **integer** display for
macro grams, but only where it reads as an amount; per-100 g reference composition keeps
its precision.

- **Consumed/aggregate macro amounts** (meal & day totals, journal) and **target
  floors/ceilings** → **integer** (round half-up).
- **Per-100 g food/recipe composition** and **per-portion recipe macros** → **1 decimal**.

**Rationale:** integers read cleaner for the amounts the user pilots day to day and for the
Cibles engine floors/ceilings, and removing the trailing decimal also fixes the raw-float
threshold (`max. 135.29999999999998 g`). Per-100 g values are reference densities where
0.5 g is meaningful, so they stay at 1 decimal. Display-only — storage keeps full precision
(CLAUDE.md rule 2). `design/components/metric-cards.md` already shows integer threshold
examples (`min. 50 g`, `max. 150 g`) and is unchanged.

---

## B-033 / B-038 — Day activity always set (no "unset"); deficit readout always shown — RESOLVED (author)

Post-v1 backlog triage (BF-2 + B-033). The schema previously allowed
`day_log.activity_level` to be NULL, surfaced in the UI as "Non définie"; the burn/deficit
readout beside the verdict was hidden whenever activity was unset, so on a default day it
was absent (B-038). The author decided the "unset" activity state must **not exist anywhere**.

- **No unset activity, ever.** `day_log.activity_level` becomes **NOT NULL DEFAULT
  'sedentary'** (1.20). The "Non définie" option is removed from the Repas activity select,
  the DTO/`PATCH` no longer accept null, and existing NULL rows are backfilled to
  `sedentary` by migration. There is no display, DB, or request path where activity is
  null. _(Author: "par défaut c'est sédentaire et point barre.")_
- **Deficit readout always rendered.** The burn/deficit block (kept next to the OK/NOK
  verdict) is always shown and populated; since every day now has an activity, it computes
  on any day that has a body weight. It falls back to a short placeholder only when the
  account has **no weigh-in yet** (no weight → no BMR). _(Author.)_
- **No "constat" caption.** The mockup's faint literal label "constat" is **intentionally
  omitted** from the UI (author preference — the word is mockup jargon). The readout shows
  the burn + deficit/surplus + kg/week only. Recorded in `design/NORMALIZATION_LOG.md`
  (mockup vs shipped divergence, author-approved).

**Consequence (accepted):** recent-average activity (Cibles) and per-period activity
multiplier (Poids) now include **every** logged day (each ≥ sedentary); the prior behaviour
that excluded null-activity days no longer applies — the sedentary fallback fires only when
there is no logged day at all. Specs updated: `spec/schema/tables-logging.md`,
`spec/api/days-meals-leftover.md`, `spec/logic/day-snapshot-verdict.md` §7,
`spec/logic/metabolic-engine.md` §3, `spec/logic/weight-periods-trajectory.md`,
`specifications/screens/meals.md`.

---

## B-035 — Recipe builder live yield panel via a preview endpoint — RESOLVED (author)

Post-v1 backlog triage (batch BF-3). `specifications/screens/recipe.md` mandates that the
builder's "Rendement & portions" panel (total weight, total macros, servings, weight/portion,
per-portion macros) **recompute live** as ingredients are added/edited/removed. The shipped
builder only showed those figures **after save** (read from `GET /recipes/:id`), so the panel
sat empty while editing — a divergence from the screen contract.

The web app cannot compute the figures itself: the macros need each ingredient's per-100 g
composition, which the combined-log search (`LoggableItem`) does not expose, and `CLAUDE.md`
rule 2 forbids the web from computing any nutrition figure. The server already owns the maths
(`resolveTotals`/`per100`/`perPortion`/`weightPerPortion`) but only over a **persisted** recipe.

- **Decision:** add a **stateless** `POST /recipes/preview` endpoint. The builder posts the
  current draft (the recipe body minus `name`, debounced) and receives all derived figures for
  the **unsaved** draft, **without persisting** (no row, no derived-food rebuild, no cycle
  check — read-only, user-scoped). The yield panel renders them live; after save it keeps
  reading the persisted figures from `GET /recipes/:id`. _(Author.)_

**Rationale:** keeps the entire nutrition computation on the backend (rule 2) while honouring
the screen contract's live-recompute requirement — preferred over leaking ingredient macros to
the client and computing totals there. Reuses the existing derivation maths
(`spec/logic/recipes-derived-food.md`), so there is no new logic, only a new read-only view of
it. `screens/recipe.md` is **unchanged** (the code is brought into line with it).

**Spec impact:** `spec/api/foods-recipes.md` §Recipes gains `POST /recipes/preview` + the
`RecipePreview` payload. No schema change (nothing persisted).

---

## B-040 — Stats heatmap tooltip kcal; reconciled API ↔ screen — RESOLVED (author)

Post-v1 backlog triage (batch BF-5). The two contracts disagreed on the Stats calendar
heatmap tooltip: `specifications/screens/stats.md` ("Hover a heatmap cell / bar → tooltip
(date, status, **kcal**)") wanted the day's calorie value, but the API contract
`spec/api/weight-targets-stats-settings.md` defined the cell as `{date, status}` only — no
kcal. The shipped tooltip therefore showed date + status, diverging from the screen contract.

- **Decision:** add the per-day calorie value to the heatmap cell. The adherence response's
  heatmap entry becomes `{date, status, kcal:number|null}` — `kcal` is the logged day's
  calorie value, `null` for `status:'none'` (not-logged) cells. The cell tooltip renders
  `date · status · kcal` when present. _(Author — confirmed during BF-5 planning.)_

**Rationale:** the data is already available server-side (the stats `DayStat` carries `kcal`),
so this only surfaces an existing figure — no new computation, no schema change. Honours the
screen contract (rule 2: the web renders the server's value, never recomputes it). Chosen over
dropping the kcal requirement from the screen spec.

**Spec impact:** `spec/api/weight-targets-stats-settings.md` §Stats `/stats/adherence` heatmap
cell gains `kcal:number|null`; `specifications/screens/stats.md` already specifies it (now
consistent). DTO `HeatmapCell` + domain `heatmap()` updated. No schema change.

---

## B-042 — Cibles target BMI + live recompute via a preview endpoint — RESOLVED (author)

Post-v1 backlog triage (batch BF-6). `specifications/screens/targets.md` mandates that the
Cibles screen show a derived **target BMI** ("Objectif de poids" group) and that editing any
calorie/ratio/target field **recomputes live** (derived grams, carb ceiling, deficit, BMI).
The shipped screen exposed **no** target BMI at all, and the engine readout only refreshed
**after Save** (read from `GET /target`) — a divergence from the screen contract.

The web app cannot fill either gap itself: `CLAUDE.md` rule 2 forbids the web from computing
any BMI, and the live figures need the full metabolic engine. The server already owns the
maths (`computeEngine`, `domain/weight/bmi`) but only over the **persisted** target.

- **Decision (target BMI):** add `target_bmi` to the engine readout, computed server-side as
  `target_weight_kg / (height_m)²` (the existing BMI formula, on the _target_ weight), null
  when no target weight is set. Carried by both `GET /target` and the new preview endpoint.
- **Decision (live recompute):** add a **stateless** `POST /target/preview` endpoint. The form
  posts the current draft target (the create body minus `effective_from`, debounced) and
  receives the engine readout for the **unsaved** draft, **without persisting** (no row written
  — read-only, user-scoped). Live recompute is scoped to the **target draft**: the preview uses
  the **persisted** profile + latest weigh-in; profile fields (sex/birthdate/height) still
  refresh the engine on their own `PATCH /profile` save, as before. _(Author — confirmed
  during BF-6 planning, "tout B-042 maintenant".)_

**Rationale:** keeps the entire nutrition computation on the backend (rule 2) while honouring
the screen contract — preferred over computing BMI/derived grams in the client. `target_bmi`
reuses the proven `bmi()` (no new maths); the preview reuses the pure `computeEngine` (a new
read-only view of it, mirroring `POST /recipes/preview`, B-035). `screens/targets.md` is
**unchanged** (the code is brought into line with it).

**Spec impact:** `spec/logic/targets-macros.md` gains §6 (Target BMI + oracle);
`spec/api/weight-targets-stats-settings.md` §Targets adds `target_bmi` to the engine object
and the `POST /target/preview` endpoint; DTO `EngineReadout` gains `target_bmi`, plus
`TargetPreviewSchema`/`PreviewTargetResponse`. No schema change (nothing persisted).

---

## B-006 — Custom ▲▼ stepper on number inputs — RESOLVED (author)

Post-v1 backlog triage (batch BF-6). The bug report was a display nit: on number fields the
value was glued to the browser's spinner arrows, with no spacing. The desired layout is
`value · unit · spinner`, the arrows at the field's far right after the unit.

A native `<input type=number>` spinner **cannot** produce that order: the browser anchors its
spinner to the right edge of the input's _content_ (immediately after the number), so any
right padding only shifts the number+spinner block left and the unit ends up to the right of
the spinner (verified in Firefox). The only way to get `value · unit · arrows` is to draw the
stepper ourselves.

- **Decision:** hide the native spinner and add a **custom stacked ▲▼ stepper** inside the
  field box at the far right, after the unit (two borderless arrow buttons stacked vertically,
  ~20px column, 1px divider, hover `--accent`). The real `<input type=number>` is kept (typing
  - keyboard ↑/↓ unchanged); the buttons drive the value via the input's own
    `stepUp()`/`stepDown()` (so `step`/`min`/`max` are honoured) and notify the controlled
    parent. Lives in the shared `NumberInput`, so every number field gets it. _(Author —
    chosen over the native spinner after the layout was shown to be impossible natively; the
    user picked the triangles-with-divider variant from an HTML mockup.)_

**Rationale:** the requested layout is unachievable with native spinners; a custom stepper is
the minimal control that delivers it consistently across browsers while keeping the native
input semantics. Reuses the recipe-servings stepper idea, but as a stacked ▲▼ variant on the
field's edge (the recipe one is a separate horizontal −/+).

**Spec impact:** `design/components/forms-inputs.md` — the number-input canonical now carries
this stepper (and the recipe-servings stepper is noted as the distinct horizontal −/+
variant). The custom stepper is no longer recipe-servings-only. No data/API/schema change.

---

## B-004 / B-005 — First-run setup wizard: confirm-password + pre-auth top bar — RESOLVED (author)

Post-v1 backlog triage (batch IMP-2). The first-run **setup wizard** — the only way to create
the single owner account on a fresh install — diverged from the pre-auth screen contract in two
ways. It had **one** password field (a typo there silently locks the owner out of their only
account, with no in-app recovery by design — see `screens/login.md` "Deliberate omissions"), and
it carried **no** pre-auth controls, whereas the Login screen mandates a top bar with FR/EN +
dark/light "posed here on the simplest screen". The wizard has no dedicated screen spec; its
nearest authority is the pre-auth spec `specifications/screens/login.md`.

- **Decision (B-004):** the credentials step requires the password **entered twice**; the two
  must match (and meet the existing 8-char minimum) before the owner account can be created. A
  mismatch marks the confirmation field invalid (`aria-invalid`, the canonical red-border state)
  with a hint, and keeps the step's "Continuer" button disabled. The confirmation is a **client
  guard only** — the API still receives a single `password`; no DTO/endpoint change. _(Author —
  approved as an improvement; chosen over a reveal-toggle because re-entry is the safer guard for
  a non-recoverable single account.)_
- **Decision (B-005):** the wizard carries the **same pre-auth top bar** as Login — FR/EN +
  dark/light segmented toggles — applied client-side and live (theme swaps tokens, FR/EN swaps
  strings), exactly as on Login. The bar is extracted into a shared `AuthTopBar` used by both
  screens (Login's appearance unchanged). No theme persistence is introduced (still client-side,
  per the login spec's still-open "proposed addition"). _(Author — chose **theme + language**
  over theme-only for full pre-auth parity, IMP-2 planning.)_

**Rationale:** both fixes raise safety/parity to the Login contract without computing anything in
the web or touching domain data — purely pre-auth UX. Reusing `ThemeToggle` and the canonical
text input keeps the design contract unchanged.

**Spec impact:** `specifications/screens/login.md` (git-ignored local authority) gains a
"First-run setup wizard (related pre-auth screen)" section recording both requirements. **No**
`design/`, `spec/api/`, `spec/logic/`, DTO, or schema change — the confirm field and the toggles
are all web-only.

---

## IMP-3 — Repas & journal UX/behaviour (batch) — RESOLVED (author)

Post-v1 backlog triage (batch IMP-3). Eight Repas items where the shipped behaviour
diverged from, or was under-specified by, the contracts. Each was approved as an
improvement and the relevant contract amended first.

- **B-023 — Autocomplete Enter selects the first/highlighted suggestion.** The inline
  food search left no item highlighted on open, so Enter did nothing until the user
  pressed ↓. **Decision:** the first matching suggestion is highlighted by default;
  Enter selects the highlighted one (first unless ↑/↓ moved it). _(Author — matches the
  already-stated `forms-inputs.md` "Enter selects" and the spreadsheet-fast intent.)_
  **Spec impact:** `specifications/screens/meals.md` (Entry interactions). Web-only
  (`components/Form/Autocomplete`); no API/schema change.

- **B-026 — Activity-level help legend.** No affordance explained the five activity
  levels. **Decision:** a "?" button beside the "Activité du jour" selector opens a
  legend popover, closing on outside-click/Esc. **Reworked (same session):** the first pass
  reused the existing weekly-frequency descriptions ("1–3 j/sem"), useless for choosing a
  **daily** level. Per the backlog's "propose before developing" requirement, the legend now
  shows, per level, a **real daily-activity example** (with step counts) **and** the
  **calories from activity alone** — kcal/day **above** the BMR (`BMR×multiplier − BMR`), an
  absolute value per level, **not** the TDEE. These are **server-computed** (web never
  computes nutrition): `DayConstat` gains `per_level_activity_burn` (map of the 5 levels →
  kcal, null without a weigh-in), built in `services/day-assembler.ts`. The raw
  multiplier/"PAL" is **not** surfaced. _(Author — wanted activity-attributable calories,
  absolute per level.)_ **Spec impact:** `specifications/screens/meals.md`,
  `design/components/metric-cards.md`, `spec/api/days-meals-leftover.md` (constat field). DTO
  `DayConstat.per_level_activity_burn`; i18n `activity.*.description` rewritten to daily
  examples + `meals.activity.kcalPerDay`. No DB schema change.

- **B-028 — Clickable, positional empty lines.** Only the first trailing empty line was
  clickable; the rest were inert fillers, and a food could only be appended. **Decision:**
  every empty row is a clickable "+ aliment"; a food is added at the exact clicked row
  (`order_index` = row); intentionally-blank rows above are preserved (persisted), not
  collapsed. _(Author — "if I leave blank lines, that's my choice".)_ **Spec impact:**
  `specifications/screens/meals.md` (Entry) + `spec/api/days-meals-leftover.md`
  (`POST /meals/:mealId/entries` gains optional `order_index`). DTO: `CreateMealEntryRequest`
  gains optional `order_index`. No schema change (`meal_entry.order_index` already exists).

- **B-029 — Drag-to-reorder lines persists.** The FoodLine drag grip was a visual
  placeholder with no handlers and no persistence. **Decision:** wire native HTML5 DnD on
  the grip; the new order persists via a new reorder endpoint. _(Author — the screen spec
  already lists a drag grip; reordering should survive reload.)_ **Spec impact:**
  `specifications/screens/meals.md` + `spec/api/days-meals-leftover.md`
  (`PATCH /meals/:mealId/entries/order` — atomic, user-scoped, `{order:[{id,order_index}]}`).
  New DTO `ReorderEntriesRequest`. No schema change (`order_index` already exists).

- **B-031 — Portion unit chip shows "nb".** The chip rendered the literal word
  "portion", truncated to "port…". **Decision:** a portion shows the compact abbreviation
  "nb" (display-only — NOT a generic "nb" unit; the underlying unit stays the food's
  specific named portion). _(Author — explicit choice.)_ **Spec impact:**
  `design/components/data-tables.md` (chip label). Web-only; no API/schema change.

- **B-032 — Portion chip tooltip shows label + grams.** The chip title showed "portion".
  **Decision:** for a portion the chip tooltip shows `label (grams g)` (e.g. "œuf (57 g)");
  plain unit otherwise. **Spec impact:** `design/components/data-tables.md`. Web-only.

- **B-037 — Unified status wording.** The cards mixed `DANS LA CIBLE`/`AU-DESSUS`/`SOUS`.
  **Decision:** `OK` for any in-target value, `DÉPASSÉ` for any over-target, `EN-DESSOUS`
  for any under-target (EN: OK / Over / Below), across the calorie band and macro
  floor/ceiling cards. _(Author — approved wording in backlog B-037.)_ **Spec impact:**
  `design/components/metric-cards.md` (Domain states). i18n values only; no code/API/schema
  change.

- **B-044 — Threshold marker is a notch.** The 2px `var(--text)` tick was nearly invisible
  over the light-green `--ok` floor fill. **Decision:** replace the over-drawn tick with a
  **notch** cut into the bar (a card-background-coloured sliver flanked by a
  `--border-strong` edge), legible over any fill colour. _(Author — picked "encoche".)_
  **Spec impact:** `design/components/metric-cards.md` (Target indicator). CSS-only; reuses
  existing tokens (`--bg-elev`/`--bg-elev-2`/`--border-strong`), no new token, no API/schema.

- **B-016 — Future-day planning.** The ‹ › arrows already let the user view/edit a future
  day, but the `CalendarPopover` disabled future dates, and the spec was silent on
  `date > today`. **Decision:** (1) the calendar **allows selecting future days** (parity
  with the arrows — plan meals ahead); (2) the **Repas screen is unchanged** — a future day
  behaves like today (live snapshot, OK/NOK badge + Forcer OK/NOK/Auto menu all work);
  (3) **Stats exclude any day with `date > today`** until its date arrives, so a planned day
  never lowers the OK rate, breaks the OK streak, skews rolling windows / best month /
  signals, or shows red on the heatmap (it stays grey "non saisi"). Once `date ≤ today` the
  same `DayLog` counts normally. _(Author — "le menu OK/NOK/Auto continue à fonctionner tel
  quel, mais dans les stats tu prends pas en compte tant que dans le futur".)_ **Spec
  impact:** `spec/logic/stats-adherence.md` §1+§3, `spec/logic/day-snapshot-verdict.md` §3,
  `specifications/screens/meals.md`, `specifications/screens/stats.md`. **Code:** web
  `CalendarPopover.tsx` (remove the future guard + unused `.future` style); api
  `services/stats.ts` (filter `DayStat[]` to `date ≤ today` in `getAdherence`, clamp the
  rolling anchor/range to today in `getRolling`). No DB/API-contract/`design/` change.

---

## IMP-5 — Targets guidance presets + favicon (B-007, B-011) — RESOLVED (author)

Post-v1 backlog triage (batch IMP-5). Two small improvements; both amend a contract.

- **B-007 — Cibles g/kg guidance presets.** A user on the Cibles screen rarely knows what
  protein/fat **g/kg** value to enter, and `specifications/screens/targets.md` offered no
  guidance. **Decision (author):** under each ratio field, show **three clickable
  suggestions**, each with a plain-language legend describing who the value is for; **a
  click fills the manual field** (still editable). Protein: **0.8** (sédentaire), **1.8**
  (actif / en déficit), **2.2** (sportif intensif). Fat: **0.6** (minimum — plancher
  hormonal), **0.9** (courant), **1.2** (élevé). These are **static guidance**
  copy/values — the web computes nothing (CLAUDE.md rule 2); picking one just sets the
  draft, which then drives the existing live `POST /target/preview` recompute (B-042).
  _(Author — "3 propositions de valeurs cohérentes, et une explication de ce à quoi
  correspondent ces valeurs… 3 boutons qui iront inscrire une valeur dans le champ.")_
  **Spec impact:** `specifications/screens/targets.md` (Ratios de macros — presets
  documented). **Code:** new web `features/targets/components/RatioPresets.tsx` +
  `cibles.module.css` `.presets`/`.presetBtn` + `cibles.targets.presets.*` i18n (FR+EN).
  No API/DB/`design/` change.

- **B-011 — Favicon.** The app shipped no favicon (`index.html` had no `<link rel="icon">`,
  no `public/` dir); no contract specified one. **Decision (author):** add a favicon
  **derived from the brand "tick"** (metronome ring + a **frozen** needle, accent amber
  `#e0b341` baked in — favicons can't read CSS vars), as **SVG primary + ICO fallback**.
  **Spec impact:** `design/components/00-foundations.md` (Brand mark — favicon note).
  **Code:** new `packages/web/public/favicon.{svg,ico}` (the `.ico` generated by a
  committed, one-off, dependency-free `packages/web/scripts/gen-favicon.mjs` — **not** a
  build/CI step) + two `<link>` tags in `packages/web/index.html`. Vite copies `public/*`
  to `dist/`; the API already serves `dist/` statically (`http/spa.ts`), so both resolve in
  prod with no API change.

---

## LO-1 — Leftover: consumed Qté column, served→consumed preview & list/edit/delete (B-047) — RESOLVED (author)

Post-v1 backlog triage (batch LO-1, critical-correctness). The proration **maths are
unchanged and correct** (`spec/logic/leftover-proration.md`, `domain/leftover/`); this batch
fixes the display + adds the missing UI. Three facets, all decided with the author:

- **Qté column shows the consumed quantity.** Bug: after a leftover applied, a line's macros
  and the meal total switched to _consumed_ but the Qté column stayed on the _served_ value,
  so the total no longer matched the listed quantities. **Decision (author, option "champ
  éditable affichant le consommé"):** the Qté field **stays editable** but **at rest shows the
  consumed quantity**; typing a value still writes the **served** quantity (the server
  re-prorates). To support this without the web computing proration (CLAUDE.md rule 2), the
  server adds `MealEntry.consumed.quantity` = `served_quantity × consumed_grams / served_grams`
  (a display projection; equals `served_quantity` with no leftover). The web `QtyCell` tracks a
  `dirty` flag so a focus/blur without a keystroke never overwrites served with consumed.

- **Served → consumed preview table.** `screens/meals.md` already required a pre-apply preview
  and the mockup (`specifications/mockups/meals.html` `.lo-preview`) drew it, but it was never
  implemented. **Decision:** show the served → consumed table (new value in red, `--delta-neg`)
  in the create **and** edit forms. Because rule 2 forbids client-side proration, a new
  **stateless** endpoint `POST /meals/:mealId/leftover/preview` returns the per-line consumed
  grams (same pattern as `POST /recipes/preview` B-035, `POST /target/preview` B-042). It takes
  `{entry_ids, gross_grams, tare_g}` — the web supplies the tare (a number it already holds from
  the container catalog, or a group's frozen `tare_g` on re-edit), so create / re-edit /
  since-deleted-container are handled uniformly; only the proportional split runs server-side.

- **Leftover list + re-edit + delete.** The API `PATCH`/`DELETE /leftover/:groupId` existed but
  had **no UI**. **Decision (author, option "⊟ Restes ouvre une liste"):** the ⊟ Restes button
  opens a **list** of applied leftovers (each: container · −net g · n lines, with Éditer /
  Supprimer) plus **＋ Nouveau reste**. Edit restores the saved gross weight + container +
  selection and saves via PATCH; if the frozen container was since deleted, its name+tare are
  shown and kept (PATCH omits `container_id`). Delete reverts the lines to fully consumed.

  **Spec impact:** `specifications/screens/meals.md` (Qté mapping + Leftover-proration flow),
  `spec/api/days-meals-leftover.md` (`consumed.quantity` field + preview endpoint),
  `spec/logic/leftover-proration.md` §6b (consumed-quantity display note). **Code:** shared
  `dto/day.ts` (`consumed.quantity`, `LeftoverPreviewRequest`/`Response`); api
  `services/day-assembler.ts` (compute `consumed.quantity`), `services/leftover.ts` (`preview`),
  `http/controllers/leftover.ts` + `http/routes/meals.ts` (preview route); web `api/leftover.ts`
  (preview client), meals `useLeftoverPreview` hook, `QtyCell.tsx`, and the `LeftoverModal`
  (mode router + `LeftoverList` + `LeftoverPreview` + `useLeftoverForm` edit support) + i18n.
  No DB/schema change (consumed stays derived; nothing new persisted).

## B-048 — Recipes list: drop the redundant per-row "recette" badge — RESOLVED (author)

Post-v1 backlog triage (batch BF-8). The Recipes list rendered a "recette" badge on **every**
row (`features/recipes/components/RecipeRow.tsx`), faithfully matching the mockup
(`specifications/mockups/recipe.html` list row + `screens/recipe.md`). On a screen where every
row is by definition a recipe the badge is pure noise. **Decision (author):** remove the badge
from the **list rows**; **keep** it in the recipe **modal header** (it still labels the open
record). This is a deliberate, minor **deviation from the visual contract**, so the screen spec
is annotated rather than the code silently diverging.

**Spec impact:** `specifications/screens/recipe.md` (recipe-list row note). **Code:** removed the
`<span class=badge>` from `RecipeRow.tsx`, the now-unused `.badge` class in `recipes.module.css`,
and the `recipes.badge` i18n key (FR+EN). No API/schema change.

## B-056 — Weight chart: styled tooltip (replaces native `<title>`) — RESOLVED (author)

Post-v1 backlog triage (batch BF-9). `design/components/charts.md` mandated **native SVG
`<title>`** tooltips for every chart point/cell. On the weight chart those default browser
tooltips are slow to appear and visually poor. **Decision (author, "Tout maintenant"):** the
**weight chart** uses a **styled HTML tooltip** — a floating card (`--bg-elev-2`, `--border`,
`--r-md`, shadow, `--font-num`/`--fs-11`) anchored to the hovered point, content `date · value`.
The **heatmap and bars keep the native `<title>`** (dense grids where a styled overlay adds no
value). Faithful to the item's scope (`WeightChart` / `HitAreas`).

**Spec impact:** `design/components/charts.md` (§Shared primitives Tooltips note + §Weight chart
dots). **Code:** new web `components/Chart/ChartTooltip.tsx`; `HitAreas.tsx` drops `<title>` and
emits hover callbacks; `WeightChart.tsx` holds the hovered point + relative wrapper; tooltip
styles in `Chart.module.css`. No API/schema change.

## B-058 — Stats signals: no-NOK-run signal + server-decided status dot — RESOLVED (author)

Post-v1 backlog triage (batch BF-9). Two divergences from the mockup
(`specifications/mockups/stats.html`): (1) the signals panel always shows a NOK-streak line —
`nok_run` when ≥ 3, else "Pas de série NOK en cours." — but `stats-adherence.md §7` only emitted
`nok_run` (≥ 3), so with no streak **nothing** was shown; (2) the mockup colours the 14-day OK
rate **green ≥ 70 % / red otherwise**, but the app always showed it blue. The colour is a verdict
on the rate, which rule 2 forbids the web from computing. **Decision (author):** the server emits
a positive **`nok_run_clear`** signal when the current NOK run is `< NOK_RUN_ALERT`, and **every
signal carries a server-decided `status`** (`ok`/`warn`/`info`) driving the design's status dot.
`ok_rate_14` → `ok` when `value ≥ OK_RATE_GOOD_PCT` (= 70), else `warn`.

**Spec impact:** `spec/logic/stats-adherence.md §7` (nok_run_clear + status table + threshold
constant). **Code:** shared `dto/stats.ts` (`Signal.status`), `constants/tuning.ts`
(`OK_RATE_GOOD_PCT = 70`) + `index.ts` export; api `domain/stats/signals.ts` (status per signal,
nok_run_clear else-branch, ok_rate_14 threshold, `okRateGood` param) + `services/stats.ts`;
web `features/stats/components/Signals.tsx` (dot driven by `status`, `DOT_BY_CODE` dropped) +
i18n `stats.signal.nok_run_clear` (FR/EN). No DB/schema change.

## B-061 — Compte: drop the two helper description texts — RESOLVED (author)

Post-v1 backlog triage (batch BF-11). The Compte mockup (`specifications/mockups/account.html`)
carried two grey helper lines: the page lead "Tes identifiants et ta session." and a password-row
note "Pour ta sécurité, la modification passe par un flux dédié…". Both are noise on a screen
that already reads clearly. **Decision (author, "Amender + tout faire"):** remove both texts. The
screen header keeps the spacing the lead used to provide.

**Spec impact:** `specifications/mockups/account.html` (lead div + password-row `<span class="d">`
removed). **Code:** `features/account/AccountPage.tsx` (the `<p class=lead>` and the nested note
`<span>` dropped, `h1` margin-bottom raised to keep header→card spacing); `account.module.css`
(`.lead` + `.desc` rules removed); i18n keys `account.lead` + `account.passwordNote` removed
(FR+EN). No API/schema change.

## B-062 — Contenants: drop the on-screen breadcrumb — RESOLVED (author)

Post-v1 backlog triage (batch BF-11). `specifications/screens/containers.md` specified an
on-screen breadcrumb "Réglages › Contenants". The screen is reached from the single account-menu
entry, so the breadcrumb is redundant chrome. **Decision (author, "Amender + tout faire"):**
remove the on-screen breadcrumb (the account-menu entry already locates the screen; the route
`/containers` is unchanged).

**Spec impact:** `specifications/screens/containers.md` (Route section — breadcrumb removed).
**Code:** `features/containers/ContainersPage.tsx` (the `<div class=crumb>` dropped);
`containers.module.css` (`.crumb` rule removed); i18n key `containers.crumb` removed (FR+EN). No
API/schema change.

## B-065 — Journal: denser table rows — RESOLVED (author)

Post-v1 backlog triage (batch BF-11). The shared dense-table contract sets `tbody td` vertical
padding to `7–9px` (`design/components/data-tables.md`); the Journal used the shared 8px and felt
too tall for a scan-heavy day list. A perceptible reduction falls below the shared range.
**Decision (author, "Amender + tout faire"):** the **Journal** table opts into a denser row
(`padding-top/bottom: 4px`), Journal-scoped so the other tables (Aliments/Recettes/Poids/
Contenants) keep the 7–9px default.

**Spec impact:** `design/components/data-tables.md` (tbody td note — Journal denser-row exception).
**Code:** `features/journal/components/JournalTable.tsx` (a `journalTable` class on the `<table>`)

- `journal.module.css` (`.journalTable tbody td { padding-top/bottom: 4px }`, a plain `td`
  descendant scoping the override across CSS modules). No API/schema change.

## B-069 — Sticky table header sits under the appbar (account menu overlay) — RESOLVED (author)

Post-v1 backlog triage (batch BF-11). On Journal/Recipes, opening the account dropdown showed the
sticky table header painted over the menu. Root cause: the appbar owns a stacking context
(`position:sticky; z-index:var(--z-appbar)` = 50), trapping the menu popover (z 80) inside it,
while the page's sticky `thead` used `--z-popover` (60) at the root level — so the header outranked
the trapped menu. `data-tables.md` documented the `thead` at the `--z-popover` range.
**Decision (author, "Amender + tout faire"):** a sticky table header is _content under the appbar
chrome_, so it uses `--z-sticky-sub` (40, below `--z-appbar`). The appbar — and the account menu
in its context — now overlays the header. The header still paints above the static body rows, so
scrolling is unaffected.

**Spec impact:** `design/components/data-tables.md` (sticky-header z-index → `--z-sticky-sub`).
**Code:** `components/DataTable/DataTable.module.css` (`.table thead th` z-index
`var(--z-popover)` → `var(--z-sticky-sub)`). No appbar/`.acctPop` token change, no API/schema
change.

## IMP-6 — Meals UX: clear-all + comment/verdict on the date line (B-046/B-063/B-064) — RESOLVED (author)

Post-v1 backlog triage (batch IMP-6, improvement). Three Meals-screen UX changes that free
vertical space and add a fast "wipe the day" action. Decided with the author.

- **B-046 — "Tout effacer".** A button on the controls row, **left of "+ Repas"**, empties the
  day. **Behaviour (author):** it removes every logged food/quantity and any leftover deductions,
  **keeps the garde-manger lines at qty 0**, **keeps the day comment and the activity level**, and
  resets the verdict to **Auto** (`verdict_override` cleared). It is guarded by the shared confirm
  modal (destructive flow, `design/components/modals.md`), not a native `confirm()`. The clear is a
  single **atomic server operation** (CLAUDE.md rule 2 — no client-side delete loop): a new
  endpoint `POST /days/:date/clear` deletes the day's leftover groups, deletes non-pinned entries
  (custom lines + non-pinned referenced lines), zeroes pinned referenced lines, and clears
  `verdict_override`; → 200 DayDetail. A never-materialized scaffold is a no-op; a summary day →
  409 `summary_day_readonly`. Pin membership is resolved live from `pantry_item`, the single source
  of truth (`spec/logic/pantry-pin.md`).

- **B-063 — day comment on the date line.** The comment field moves up from its own row into the
  sticky header's **date line** (after the day-type tag), saving vertical space.

- **B-064 — OK/NOK badge on the date line.** **Scope decision (author):** only the **OK/NOK/Auto
  badge** moves onto the date line (far right); the **activity selector (+ "?") and the
  burn/deficit constat stay** in the totals-row verdict cluster. The date line then reads
  date selector · comment · OK-NOK-Auto.

**Spec impact:** `specifications/screens/meals.md` (layout/date-line, component inventory, the
"Tout effacer" interaction, comment placement, verdict-badge placement); `spec/api/days-meals-
leftover.md` (`POST /days/:date/clear`). **Code:** api `http/routes/days.ts` + `http/controllers/
days.ts` (`clear`), `services/days.ts` (`clear`), `data/repositories/day.repo.ts` (`clearDay`,
transactional); web `api/days.ts` (`clear`), meals `hooks/useDay.ts` (`clearDay`) + `hooks/
mealActions.ts` (`clearDay`), new `components/ClearDayConfirm.tsx`, `MealsPage.tsx` (button),
`components/DayHeader/DayHeader.tsx` (+ new `DayCommentField.tsx`, `DayVerdictBadge.tsx`),
`components/TotalsRow/VerdictCluster.tsx` (badge removed), `meals.module.css`, i18n FR+EN. No
DB/schema change, no design-token change.

## IMP-7 — Cibles / Compte / Setup restructure (B-059/B-060/B-071) — RESOLVED (author)

Post-v1 backlog triage (batch IMP-7, improvement). Three changes across the boundary between the
Cibles screen, the Compte screen and the first-run setup wizard. Decided with the author. No
DB/schema change and **no API-contract change** (`PATCH /profile` and `POST /target` already exist).

- **B-059 — 3rd "Mes cibles" setup step.** The first-run wizard gains a third step after
  credentials and profile, mirroring the Cibles ratios with the **same clickable guidance presets**.
  Fields = calorie min/max + protein g/kg + fat g/kg, **pre-filled** with sensible defaults
  (**1950 / 2050 kcal, 1.8 g/kg protein, 0.8 g/kg fat**) and editable. **Behaviour (author):** the
  step is **required** — initial targets are **always** created. The web posts `POST /auth/setup`
  as before, then (session now open) posts `POST /target` with the collected values
  (`target_weight_kg`/`rate_kg_per_week` null, `effective_from` = today). A `POST /target` failure
  is **non-blocking** (the account exists; targets stay editable on Cibles) — the user still enters
  the app.

- **B-060 — profile moves from Cibles to Compte.** Sexe / Date de naissance / Taille are _profile_
  data, not _targets_. Their **editor moves** to the Compte screen in a new **"Mes informations"**
  frame below "Identifiants" (`PATCH /profile`, unchanged). **Scope decision (author):** Cibles
  **drops the profile editor entirely** — only the derived read-out (age, current weight, recent
  activity) remains in the engine column; the engine still reads the profile server-side.

- **B-071 — derived-fields layout (amends B-042 presentation).** On Cibles, the carb ceiling and
  the target BMI now render **like the editable g/kg fields**: a caption, a **disabled/greyed field
  box** holding the server-computed value, and a **"calculé"** tag just to its right. The
  explanatory sentence "Les glucides ne se saisissent pas : ils sont le reste calculé (plafond à
  droite)." and the target-BMI inline hint are removed; the carb label shortens to "Glucides".

**Spec impact:** `specifications/screens/login.md` (setup wizard now three steps; targets step
documented); `specifications/screens/targets.md` (profile no longer edited here → points to Compte;
derived-fields layout); `specifications/screens/account.md` ("Mes informations" frame).
**Code:** web setup `useSetup.ts` (+`targetsValid`, defaults, `POST /target` on create),
`SetupWizard.tsx` (3 steps), new `steps/TargetsStep.tsx`, `setup.module.css`; account
`AccountPage.tsx`, new `components/ProfileForm.tsx` (moved from targets) + `useProfile.ts` (moved
hooks), `account.module.css`; targets `CiblesPage.tsx`, `components/EnginePanel.tsx` (profile
removed), `components/TargetFields.tsx` + `GoalFields.tsx` (new `DerivedField.tsx` replacing
`DerivedRow.tsx`), `cibles.module.css`, `useTargets.ts` (profile hooks removed); i18n FR+EN. No
DB/schema change, no API-contract change, no design-token change.

## IMP-8 — Journal enhancements (B-066/B-067) — RESOLVED (author)

Post-v1 backlog triage (batch IMP-8, improvement). Two Journal (`/history`) gaps. Decided with the
author. No DB/schema change.

- **B-066 — sortable columns.** The Journal table gains a sort control on **Jour · Calories ·
  Verdict · Activité** (click toggles ascending/descending; default **Jour descending**). **Macros**
  and **Commentaire** stay non-sortable. **Implementation decision (author/internal):** sorting is
  **client-side** over the already-loaded year — the whole selected year (≤366 rows) is fetched in
  one request, so an in-browser sort is instant and needs **no API sort params** (this is why the
  backlog's _suggested_ "API sort parameters" delta was not taken; the API contract only documents
  that sorting is client-side). Verdict nulls sort last in both directions; activity sorts along the
  canonical sedentary→active scale.

- **B-067 — year selector bounded to data.** Previously `▶` was capped at the current year while `◀`
  walked back indefinitely into empty years. Now the stepper is bounded to the years that contain
  data: `◀` stops at the earliest logged year, `▶` at the latest. **Forward-bound decision (author):**
  `▶` reaches the most recent year with data **including a future year when days are planned there**
  (consistent with IMP-4 future-day planning). The **current year is always reachable** even with no
  data. The `GET /journal` response gains global **`min_year`/`max_year`** (across all years,
  independent of the requested year; both `null` when no day is logged) to drive the bounds.

**Spec impact:** `spec/api/days-meals-leftover.md` §Journal (response gains `min_year`/`max_year`;
sorting noted as client-side); `specifications/screens/history.md` (sortable columns + bounded year
selector). **Code:** shared `dto/day.ts` (`JournalResponse.min_year/max_year`); api
`day-read.repo.ts` (`yearRange`), `services/journal.ts`; web `features/journal/sort.ts` (new),
`JournalPage.tsx`, `components/JournalTable.tsx`, `components/JournalHeader.tsx`. Tests:
`packages/api/test/integration/journal.test.ts` (new), `packages/web/src/features/journal/sort.test.ts`
(new). No DB/schema change, no design-token change.

## BF-10 — Meals mobile responsive (B-053/B-054) — RESOLVED (author)

Post-v1 backlog triage (batch BF-10, mixed). Two of the four items diverged from the local Meals
spec's §Responsive section and needed a contract amendment (the other two, B-055/B-075, are pure
bug-fixes that already conformed). Decided with the author. No DB/schema/API change.

- **B-053 — totals not pinned on mobile.** The spec previously said "the sticky day header +
  totals remain pinned in all sizes", but on mobile the stacked totals banner ate almost the whole
  viewport. **Decision (author):** on mobile (≤ 760px) **only the date line stays pinned**; the
  totals block scrolls with the page. Desktop/tablet keep the full sticky header. Rationale: keep a
  fixed date reference while logging without a tall pinned banner crowding out the meals.

- **B-054 — mobile totals layout.** The spec's reflow text put the verdict on its own row.
  **Decision (author):** on small screens (≤ 520px) the totals reflow to **kcal full-width**, then
  **lipides | glucides**, then **protéines | (activité · OK/NOK · dépense)** — i.e. the
  activity/verdict cluster shares a row with the protein card (more compact, fewer stacked rows).

**Spec impact:** `specifications/screens/meals.md` §Responsive (≤ 760px date-line-only pinning;
≤ 520px protein|verdict layout; pinning bullet reworded). **Code (web only):**
`features/meals/meals.module.css` (the three `@media` blocks). B-055 (full-width stacked meals via
`.col { width:100% !important; flex-basis:auto !important }`) and B-075 (phantom scrollbar — gate
the scroller chrome on a DOM-free `hasOverflow(width, mealCount)` instead of reading `scrollWidth`)
are bug-fixes: `features/meals/logic/columnFit.ts` (`hasOverflow`),
`components/MealScroller/MealScroller.tsx`, test `logic/columnFit.test.ts`. No DB/schema/API change,
no design-token change.

---

## DAY-MODEL — "every day must be usable": states, light days, full Journal trame — RESOLVED (author)

Executes `specifications/analysis/day-model.md` (the authority), with one author override
recorded below. Root fix: every past/present/future day is editable whether or not it is
persisted — `PATCH /days/:date` and entry writes auto-materialize the day, killing the two 404s
(comment on an unsaved day; starting a meal on a scaffold prefill line). The day model is settled
around four **calorie-driven** states derived server-side (rule 2): `none` (future, no data) ·
`green` (detailed, Σ kcal > 0) · `yellow` (summary, `summary_kcal` set) · `red` (date ≤ today with
**no** calorie value — no row, or only comment/activity/verdict, or detailed with Σ = 0). "Logged"
for stats = green/yellow with date ≤ today; red/none/future never enter the OK-rate (already
`spec/logic/stats-adherence.md §1`).

**Phase-1 open-edge resolutions (author, 2026-06-07):**

- **Zeroed detailed day → red, excluded.** A detailed day whose lines are all 0 (cleared, or "Tout
  effacer") has no calorie value → it is **red** and excluded from the OK-rate, like an empty day.
  _(Confirms the analysis §6 default.)_
- **Future planned days are LISTED inline in the Journal.** **Diverges** from the analysis §3.5
  default ("not listed"), which §6 left open. The Journal trame is one row per calendar day from
  `max(first record, Jan 1 of year)` to today (empties red), **plus** any future day (> today,
  ≤ Dec 31) that already has a row. Future days render per content, are never red/empty-generated,
  and stay excluded from every stats aggregate until their date arrives. _(Author: listed inline.)_
- **No provenance marker; imported days not frozen.** **Overrides** the analysis §3.4/§4/§5
  freeze-imported scoping (and its proposed `imported_at` column): imported summary days are treated
  like any other data — editable and convertible. All summary days are uniform. The Journal Calories
  cell is editable on any non-`green` day. _(Author: "géré comme n'importe quelle autre donnée".)_

Subsequent contract amendments (logic states, API upsert/trame, screens, design) are recorded with
their steps; this entry is the umbrella decision.

---

## RN-1 / B-076 — Day-kind labels unified to "Complet" / "Partiel" — RESOLVED (author, 2026-06-07)

The user-facing labels for a day's kind are standardised to **Complet** (the `detailed` kind) and
**Partiel** (the `summary` kind), replacing the previous inconsistent wording ("Jour détaillé" /
"Résumé (importé)"; calendar "résumé"). EN mirrors: **Complete** / **Partial**. This establishes the
vocabulary reused by DK-1 (day-kind switch menu) and JR-1 (Journal state legend).

**Scope:** display labels only. The internal enum / DB / wire values `summary` | `detailed` are
**unchanged — no migration.** **Code (web only):** `i18n/locales/{fr,en}.json` —
`meals.dayType.detailed` → "Complet"/"Complete", `meals.dayType.summary` → "Partiel"/"Partial",
`meals.calendar.partial` → "partiel"/"partial" (`calendar.full`/`empty` unchanged); comment-only edit
in `features/meals/components/DayHeader/DayTypeTag.tsx`. No component logic, DB, schema, API, or
design-token change. **Spec impact:** `specifications/screens/meals.md` (tag reads "Partiel") +
`history.md` (day-kind vocabulary note). The `meals.summary.*` banner strings are intentionally left
untouched — DK-1 (B-078) removes that banner entirely.

---

## DK-1 / B-078, B-079 — Day-kind switch menu (Complet ⟷ Partiel) + editable Partiel kcal — RESOLVED (author, 2026-06-07)

The Repas day-type tag becomes a **clickable chip + menu** switching the day kind **both
ways**, replacing the inert tag and the "Passer en jour détaillé" banner. The chip is
colour-coded **green on Complet** (`--ok`), **yellow on Partiel** (`--accent`, the existing
calendar-partial colour — **no new token**). On a **Partiel** day the Repas Calories total is
**editable** (parity with the Journal); on a **Complet** day it stays the read-only derived Σ.

**Key behaviour decision (author, 2026-06-07): Complet→Partiel discards lines behind a strong
confirmation.** Converting a detailed day **that carries food** (Σ > 0) to Partiel is now
allowed — it **drops the day's meal lines** and sets `summary_kcal := the current Σ`, behind a
**strong confirm** (`design/components/modals.md`; foods removed, no past-day restriction). This
**relaxes** the previous absolute block, but only through a **deliberate, confirmed** path:

- **New endpoint `POST /days/:date/summary`** (mirror of `/detail`): server computes
  `summary_kcal := Σ`, drops meals (reusing the existing `dayRepo.convertToSummary`, which
  cascades entries + leftovers), sets `kind='summary'`. Idempotent on a summary day;
  materializes a missing day as summary (`summary_kcal=0`).
- **The PATCH `summary_kcal` 409 `calories_not_editable` stays** for a detailed-with-lines day:
  an _accidental_ in-place edit is still blocked; only the explicit menu conversion discards
  lines. This separates "don't silently overwrite a computed total" from "I meant to convert".

**Contracts amended:** `spec/api/days-meals-leftover.md` (new `/summary` endpoint + 409 note),
`spec/logic/day-snapshot-verdict.md §9` (two detailed→light paths), `design/components/badges-verdict.md`
(§D day-kind chip), `design/components/metric-cards.md` (editable Calories variant),
`specifications/screens/meals.md` (chip menu + Partiel state + editable Calories). **No DB/schema
change, no migration** (`kind`/`summary_kcal` already model both; CHECK holds, `summary_kcal=Σ≥0`).
Gap 3 / day-model (all summary days uniform, no provenance) unchanged.

---

## JR-1 / B-077 — Journal per-row day-state band + state legend — RESOLVED (author, 2026-06-07)

The Journal renders a **left colour band per row** keyed to the day's calorie-driven state
(`spec/logic/day-snapshot-verdict.md §8`), not just the existing red one: **green** (Complet,
`--ok`), **yellow** (Partiel, `--accent`), **red** (Rien, `--nok`). A small **state legend**
(Complet · Partiel · Rien swatches) sits to the right of the year selector.

**Decision (author, 2026-06-07): band-only for green/yellow; red keeps its soft full-row
background.** Green/yellow rows get only the thin left band; the red (empty) row keeps its
existing `--nok-soft` full-row tint as the "needs filling" emphasis. `none` (future empty) shows
no band. **No new token** — the Partiel yellow reuses `--accent` (the calendar partial-dot colour
established in DK-1; the JR-1 backlog note about possibly adding a semantic yellow is resolved by
reusing `--accent`).

**Code (web only):** `features/journal/components/JournalRow.tsx` (state→class map),
`journal.module.css` (`.summaryRow`/`.detailedRow` bands + legend styles), new
`features/journal/components/JournalLegend.tsx` (reuses the `ChartLegend` swatch pattern),
`JournalHeader.tsx` (renders the legend), i18n `journal.legend.{green,yellow,red}`. No DB, schema,
or API change. **Spec impact:** `specifications/screens/history.md` + `design/components/data-tables.md`.

---

## VR-1 / B-090 — Retroactive earliest target — RESOLVED (author, 2026-06-07)

The **earliest** target is retroactive to every date before its own `effective_from`.
The day target-snapshot rule (`spec/logic/day-snapshot-verdict.md §2`) resolves the target
in effect on a day's date as: the latest `Target` with `effective_from ≤ the day's date`,
**falling back to the earliest target overall when the day precedes every target**. A null
range now means only "the user has no target at all".

**Why:** before this, a day dated before the first target resolved to `cal_min = cal_max = 0`,
and the calorie-only auto verdict `autoVerdict(0, 0, 0)` → `0 ∈ [0,0]` → **OK**. An empty
pre-target day therefore showed **OK Auto** when it should show **NOK Auto** (a day _with_ a
target already computes NOK at kcal=0, spec §5). The §5 verdict formula is correct; the bug
was the degenerate 0/0 range. Making the earliest target retroactive gives those days a real
calorie range so they correctly read NOK, without touching the verdict formula.

**Code (api only):** `data/repositories/target.repo.ts` — `currentAsOf` adds an earliest-target
fallback (still user-scoped). `resolveSnapshotForDate` (the day GET / scaffold path) is the
relevant consumer; the other call-sites pass today and are unaffected unless every target is
future-dated (then "today" correctly shows the upcoming earliest target — consistent with the
rule). **No DB/schema change, no migration, no API-shape change.**

**Freeze rule unchanged (CLAUDE.md rule 4):** already-materialized past days keep their frozen
`target_snapshot` (the GET path uses the stored snapshot for `date < today`); pre-existing
frozen 0/0 rows stay 0/0. Only unlogged/scaffold past days (resolved live) pick up the
retroactive range. **Stats/Weight unaffected** — red days (Σ=0) are already excluded from
aggregates; only the displayed verdict changes.

**Spec impact:** `spec/logic/day-snapshot-verdict.md §2`.

---

## CP-1 / B-082 — Copy yesterday's meals into the current day — RESOLVED (author, 2026-06-07)

A **Copier hier** control on the Repas screen **replaces** the current day with a faithful
copy of the previous day (date−1), behind a strong confirm. New endpoint
`POST /days/:date/copy-from` `{from:"YYYY-MM-DD"}` rebuilds `:date` atomically from `from`:
a **detailed** source copies its meals → entries (frozen macro snapshots) → leftover groups
verbatim; a **summary** (Partiel) source makes the target Partiel with the same
`summary_kcal`. The target's existing content is dropped first (clear-then-copy, modelled on
`POST /days/:date/summary` and `/clear`).

**Behaviour decisions (user):**

- **Faithful copy — the garde-manger is NOT re-applied.** A food pinned _after_ the source
  day (so absent from it) is not injected into the copy; today equals yesterday exactly. The
  user can still re-add it. (Chosen over "re-seed pins" for predictability.)
- **Empty source → no-op + info.** If yesterday has nothing to copy (no served line, or a
  summary with no kcal, or the day does not exist), the API returns **409 `copy_source_empty`**
  (nothing written) and the web shows a small info banner ("Aucun repas hier à copier"); the
  current day is unchanged.
- **Target's own comment + activity_level are kept** (only the meal/calorie content is
  copied — same spirit as B-046 clear). `verdict_auto` is recomputed against the **target's**
  `target_snapshot` (frozen if the target day is past, live otherwise); `verdict_override`
  resets to null. `from == :date` or an invalid date → **422**.

**Why an explicit `from` (not hard-coded yesterday):** the endpoint takes the source date so
it is general and directly testable; the UI passes `date − 1`.

**Code:** new `packages/shared` DTO `CopyDaySchema`/`CopyDayRequest` + error code
`copy_source_empty`; new api `data/repositories/day-copy.repo.ts` (`copyInto`, one
transaction) + `services/day-copy.ts` (`copyFromDay`) + `http/controllers/days.ts`
(`copyFrom`) + route `POST /days/:date/copy-from`; web `api/days.ts` (`copyFrom`),
`useDay`/`mealActions` (`copyDay`/`copyYesterday`), `MealsControls` (2nd button),
`MealsPage`/`MealsOverlays` (state + overlay), new `CopyYesterdayConfirm`, i18n
`meals.copyYesterday`/`meals.copy.*`/`meals.copyEmpty`. **No DB/schema change, no migration.**

**Spec impact:** `spec/api/days-meals-leftover.md` (§Day endpoint), `spec/api/00-conventions.md`
(error-code example), `specifications/screens/meals.md` (controls row + behaviour).

## RT-1 / B-080, B-081 — Recipe rating (0–3) + archived-recipes filter — RESOLVED (author, 2026-06-07)

Recipes gain the same **0–3 star rating** as foods, and the recipes list gains the **show-archived**
filter that foods already has. The rating semantics, the `RatingStars`/`RatingPicker` components and
the "note minimale" chip behaviour are **already specified** (`design/components/rating-stars.md`,
`DECISIONS.md` Gap #7); RT-1 only extends the **recipe** surface to mirror foods. Full foods parity
chosen by the user: rating is a read-only, **sortable** column in the list, an editable picker in the
builder, and a `min_rating` filter chip row.

**B-080 (improvement, contract + migration):**

- **Schema:** `recipe.rating smallint NULL` + `CHECK (rating IS NULL OR rating IN (0,1,2,3))`
  (`spec/schema/tables-catalog.md`), Prisma `Recipe.rating Int? @db.SmallInt`, migration
  `recipe_rating` (column + `recipe_rating_check`, mirroring `food`).
- **API:** `GET /recipes` gains `min_rating` (1|2|3 — excludes Bof 0 and unrated when ≥1, mirrors
  foods) and `rating` added to the sortable set {name,batch,servings,rating}; `POST/PATCH /recipes`
  accept `rating?(null|0..3)`; `RecipeSummary`/`RecipeFull` return `rating`
  (`spec/api/foods-recipes.md`).
- **ETL (doc-only, O1 out-of-plan):** `spec/logic/migration-etl.md §5` records the "Avis" → rating map.

**B-081 (code-only bug-fix, no contract change):** the recipe archive modal already promised "Tu
pourras la restaurer" but no UI surfaced archived recipes; the API (`include_archived` +
archive/restore) already existed. RT-1 adds the missing web toggle in the **same `FiltersPopover`**
as B-080's min-rating row — that shared component is why the two items batch together.

**Code:** `packages/shared/src/dto/recipe.ts` (reuse `RatingSchema`; `rating` on Summary/Full + body;
`min_rating` on the list query; `'rating'` in `RECIPE_SORT_FIELDS`); api
`data/repositories/recipe.repo.ts` (write + `min_rating` where + rating sort column),
`services/recipes.ts` (map + pass-through); web `features/recipes/` — new
`components/FiltersPopover.tsx` (min-rating chips + show-archived; no visibility row), `RecipesToolbar`,
`RecipesPage` (state + `buildListParams`), `RecipesTable`/`RecipeRow` (sortable Note column + `Stars`),
`modals/BuilderFields`+`draft.ts` (`RatingPicker`), `api/recipes.ts` (`min_rating`), i18n
`recipes.field.rating`/`recipes.filters.*`/`recipes.col.rating`. **DB migration; no API behaviour
change beyond the additive fields.**

**Spec impact:** `spec/schema/tables-catalog.md`, `spec/api/foods-recipes.md`,
`spec/logic/migration-etl.md`, `specifications/screens/recipe.md`.
`design/components/rating-stars.md` unchanged (applies to recipes identically).

## TH-1 / B-091 — Target history editor (list / edit / delete + opt-in recompute) — RESOLVED (author, 2026-06-07)

**Problem.** The Cibles screen exposed only the _current_ target and Save hard-coded
`effective_from = today` (`draft.ts`), even though targets are already versioned by
`effective_from` (`UNIQUE(user_id, effective_from)`; `targetRepo.currentAsOf` resolves the
version in effect on a date). The gap was a read/edit surface: no way to list past versions,
correct one, back-date one, or delete one.

**Decision (improvement, contract amended; no DB migration).** Add full target-history
management on Cibles, with two user decisions taken with the author:

- **Recompute = opt-in, auto-only.** Correcting a past version leaves logged days **frozen
  by default** (CLAUDE.md rule 4). An explicit, strong-confirmed `POST /targets/:id/recompute`
  re-freezes `target_snapshot` + recomputes `verdict_auto` **only for logged days with
  `verdict_override IS NULL`** in the affected window; forced/overridden, future and
  out-of-window days are untouched, and the verdict formula is unchanged. This is the single
  sanctioned exception to the freeze rule (`spec/logic/day-snapshot-verdict.md §3`).
- **Effective date is choosable on create (back-datable) and editable** on a version.

**API (`spec/api/weight-targets-stats-settings.md`).** New plural `/targets` resource:
`GET /targets` (versions newest-first, each with `id` + `until` = day before the next
version / null for current); `PATCH /targets/:id` (edit any field incl. `effective_from`;
merged `calorie_max ≥ calorie_min` else 422; date collision → 409 `target_date_occupied`
`{existing_id}`); `DELETE /targets/:id`; `POST /targets/:id/recompute` (optional `{from,to}`
union window → `{recomputed}`); `GET /targets/:id/recompute-count` → `{count}`. `id` exposed
on the Target DTO. `POST /target/preview` gains an optional `effective_from` → engine computed
**as of that date** (weight/age/recent-activity window resolved on the date) for the history
editor; absent → today. New error code `target_date_occupied` (`spec/api/00-conventions.md`).

**Recompute window.** A version's affected window = `[effective_from, next.effective_from)`;
the earliest version is retroactive to the first logged day (VR-1/B-090). Each affected day
re-resolves its snapshot via `resolveSnapshotForDate`, so it re-freezes against whatever
version now governs its date; per-day kcal reuses the stats proration (`services/day-stat.ts`).

**Code.** shared `dto/target.ts` (`id` on Target; `TargetVersion`+`until`; `PatchTargetSchema`;
`RecomputeTargetSchema`; recompute/count responses; optional `effective_from` on preview),
`errors.ts`. api `data/repositories/target.repo.ts` (`list`/`findById`/`findByEffectiveFrom`/
`update`/`remove`), `services/targets.ts` (`recentActivity(asOf?)` + preview as-of),
`services/target-engine.ts` (`id`; `targetToListItemDto`), new `services/target-history.ts`
and `services/target-recompute.ts`, `http/controllers/targets.ts` + new `http/routes/targets.ts`
(mounted `/api/v1/targets`). web `features/targets/` — `api/target.ts`, `useTargets.ts`
(history/version mutations/recompute-count), new `useCiblesController.ts`, `draft.ts`
(`effectiveFrom`), `CiblesPage.tsx` (thin renderer), `components/TargetForm.tsx` (date field +
editor modes + freeze notice/recompute), new `components/TargetHistory.tsx`,
`RecomputeConfirm.tsx`, `DeleteTargetConfirm.tsx`, i18n `cibles.history/recompute/deleteVersion/error.*`.

**Spec impact:** `spec/api/weight-targets-stats-settings.md`, `spec/api/00-conventions.md`,
`spec/logic/day-snapshot-verdict.md §3`, `specifications/screens/targets.md`,
`design/components/data-tables.md`. **No DB/schema change.**

## MX-1 / B-085, B-086, B-087, B-088, B-089 — Meals UX polish — RESOLVED (author, 2026-06-07)

Improvement batch (web-only; **no DB/schema/API change**). Five Repas/Journal refinements where
the behaviour/appearance differed from (or was unspecified by) the contract; the contract was
amended first, then the code followed. Two behaviour decisions were taken with the author at plan
time: B-085 becomes a **custom clickable menu** (not a styled native select), and B-089 is
**applied** (it explicitly reverses the archived B-043 density decision).

- **B-085 — Activity selector: verdict-style menu + level colours.** The per-day activity
  selector (Repas) and the Journal activity cell stop being native `<select>`s and become a
  clickable badge + dropdown menu styled like the OK/NOK/Auto verdict control (open/close +
  outside-click + Escape). The five levels are colour-coded on a **non-linear scale** via a
  leading dot: Sédentaire `--nok` (red) → a jump to Léger `--accent` (yellow) → Modéré
  `color-mix(--ok 45%, --accent)` → Intense `color-mix(--ok 75%, --accent)` → Très intense
  `--ok` (green). Implemented as a generic `components/SelectMenu` + an `components/ActivitySelect`
  wrapper (the colour map) reused by both call sites.
- **B-086 — Partiel day macro cards show "—".** On a Partiel (summary) day only the calorie
  total is meaningful (DK-1/B-079), so each macro card keeps its label + target but renders the
  value as `—`, hides the bar, and omits the status word (neutral card). New optional `muted`
  prop on `MacroCard`, set from `day.kind === 'summary'` in `TotalsRow`.
- **B-087 — Custom-food modal: Enter submits when valid.** Pressing Enter saves the custom food
  when the form is valid (a positive kcal), no-op otherwise. The modal is a `<div>`, so the key
  is handled on the body (`onKeyDown`), not via native form submission; the Save button is
  unchanged.
- **B-088 — Remove the pen (✎) icon left of the comment box.** Cosmetic; the glyph was never
  specified. No real contract delta.
- **B-089 — Reduce Repas vertical density (reverses B-043).** Metric-card padding `9px 12px →
7px 10px` (gap `7 → 5`), meal-column header `11px 12px → 8px 12px`, food-line rows `32 → 28px`,
  totals grid gap `--sp-5 → --sp-4`. Archived B-043 deliberately left density "as-is"; **this
  reverses that** per the author's decision.

**Spec impact:** `design/components/metric-cards.md` (activity menu + colour map; macro "no value"
state; card density), `design/tokens.md` (density floor note), `design/components/modals.md`
(Enter = primary action), `specifications/screens/meals.md` + `history.md`. **No DB/schema/API
change.**

## IMP-1 / B-001, B-002, B-003 — Settings data management: wipe / export / import — RESOLVED (author, 2026-06-07)

Improvement batch. Adds a **Données** section to Paramètres with three account-wide actions,
reversing the earlier v1 decision recorded in `specifications/screens/settings.md` ("no in-app
import/export"). The author approved adding all three to the app. **No DB/schema change** (data
layer only); one approved global change: the Express JSON body limit is raised to 25 MB so a full
import fits. New `spec/api/data-export-import.md` is the authoritative contract.

A behaviour decision was taken with the author at plan time: **import = REPLACE / restore**, not
merge. Importing wipes the account's data and re-inserts the extract verbatim, giving a
deterministic round-trip with export and avoiding the whole class of merge-conflict bugs (duplicate
foods, two day_logs for one date, id collisions). No "merge" mode.

- **B-001 — Wipe.** `POST /data/wipe` deletes all tracked data (foods + portions, recipes +
  ingredients + derived `source='recipe'` foods, user containers, pantry, day_logs/meals/entries/
  leftovers, weigh-ins, targets) in child→parent order (RESTRICT FKs) and **preserves the seed**:
  the owner `app_user` (credentials + profile + settings), the `meal_slot_template` rows, and the
  locked built-in "Rien" container. Strong **typed confirmation** client-side.
- **B-002 — Export.** `GET /data/export` downloads a versioned JSON envelope
  (`format_version: 1`) of all the user's content **minus credentials**: profile, settings,
  template, containers, catalog, pantry, the full journal (with frozen snapshots), weigh-ins and
  targets. Decimals → numbers, DATE → `YYYY-MM-DD`, instants → ISO-8601; `created_at` preserved.
- **B-003 — Import.** `POST /data/import` validates the envelope (shape → 422
  `import_invalid_format`; bad `format_version` → 422 `import_unsupported_version`; a referentially
  broken file's DB violation → 422 `import_invalid_format`, not a 500), then in one transaction
  wipes everything (structure included), restores profile + settings (**never credentials**), and
  re-inserts the extract verbatim — original ids kept (post-wipe, no collision; so the same file
  also restores into a fresh install), owner/user columns re-pointed at the current account, and
  **frozen snapshots carried across unchanged** (`snap_*`, `target_snapshot`, `leftover_group`
  values). A defensive ensureBuiltin guarantees a "Rien" container afterwards. Strong **typed
  confirmation**; the page reloads on success (restored theme/locale applied).

New design pattern: a **typed-confirmation modal** (`design/components/modals.md`) — the danger
button stays disabled until the user types the localized word ("EFFACER"/"REMPLACER" etc.).

**Spec impact:** new `spec/api/data-export-import.md`; `spec/api/00-conventions.md` (reversed the
"no import/export in v1" line; new error codes); `spec/api/weight-targets-stats-settings.md`
(pointer); `design/components/modals.md` (typed-confirmation variant);
`specifications/screens/settings.md` (Données section + reversed removal note). **No DB/schema
change.**

---

## GM-2 / B-092, B-093, B-094, B-095 — Garde-manger prefill unit per food + picker outside-click — RESOLVED (author, 2026-06-07)

Mixed batch (precedent BF-9, BF-11). B-092/093/094 are improvements with one **additive DB
migration**; B-095 is a code-only bug-fix. Until now `pantry_item` stored no unit and the two
prefill paths (`entry.repo.ts:addZeroQtyLineToCurrentAndFuture`, `day.repo.ts:seedMealsTx`)
hard-coded `unit:'g'`, so a food usually logged in portions/ml was always prefilled in grams.

Two behaviour decisions taken with the author at intake (Run #8): **(A)** changing a pin's unit
cascades to **today + future** qty-0 placeholder lines only (past/frozen and qty>0 lines untouched);
**(B)** **the line drives the pin** — editing a pinned line's unit on Repas re-syncs the stored
pantry unit, then cascades per (A). At plan time the author additionally required that **clear-the-day
(B-046) reset pinned lines to the pin's stored unit**, not to `g`.

- **B-092 — Prefill unit on `pantry_item`.** New columns `unit` (NOT NULL DEFAULT `'g'`) and
  `portion_id` (NULL REFERENCES `food_portion(id)` ON DELETE SET NULL; set iff `unit='portion'`).
  `POST /pantry` accepts `unit?`/`portion_id?` (invalid portion → 422 `portion_id: invalid_portion`).
  Both prefill paths and clear-the-day read the stored unit/portion; fallback `g` when
  `unit='portion'` and `portion_id` is null (deleted portion). Quantity & grams stay 0 — history
  unaffected.
- **B-093 — Pin captures the line's unit + re-sync on edit.** Pinning from a day captures the
  entry's `unit`/`portion_id`. Editing a pinned line's unit re-syncs `pantry_item` and runs the
  unit cascade (decision A/B).
- **B-094 — Paramètres per-food unit selector.** New `PATCH /pantry/:id {unit,portion_id}` (persist
  - unit cascade). The editor shows a unit chip/menu (reuses the Repas `UnitMenu`).
- **B-095 — Picker outside-click.** `PantryEditor` wraps the food picker in a ref + document
  `mousedown` listener (the B-049 pattern); an outside click closes it with no food added.

**Spec impact:** `spec/schema/tables-logging.md` (pantry_item `unit`/`portion_id`); Prisma schema +
**additive migration** `pantry_item_prefill_unit` (back-fills `g`/null); `spec/api/weight-targets-
stats-settings.md` (POST body + new PATCH); `spec/api/days-meals-leftover.md` (clear resets to the
pin's unit); `spec/logic/pantry-pin.md` §3 + §5 oracle; `specifications/screens/settings.md`
(per-food unit selector + picker outside-click); `packages/shared/src/dto/pantry.ts`. DB migration
(additive, non-destructive).

---

## WT-1 / B-099 — Weight target trajectory resolves the rate per period — RESOLVED (author, 2026-06-07)

**Problem.** On the Poids screen the "trajectoire cible" curve barely descends despite a history of
1 kg/week (early) then 0.25 kg/week (recent) targets. `services/weight.ts` read a **single** target
(`targetRepo.currentAsOf(today)`) and passed one scalar `rate_kg_per_week` to `deriveTrajectory`,
which applied today's rate (0.25) to the **whole** history — the steeper early periods were lost.
Targets are versioned by `effective_from`, but the trajectory ignored that history.
`spec/logic/weight-periods-trajectory.md §4` was **silent** on multi-version targets.

**Decision (bug-fix; spec clarification, no behaviour reversal, no DB/schema/API change).** The
trajectory resolves `rate_kg_per_week` **per period** from the Target in effect on the period's
**end date** (the weigh-in that closes it — the same date that fixes the period's `diet_flag`):
the latest `effective_from ≤ end_date`, falling back to the **earliest** Target before any Target
exists (retroactive — mirrors the calorie resolution in `day-snapshot-verdict.md §2` and the
B-090 rule). The slope now changes at each rate boundary. `goal_weight` still comes from the
**current** Target (a single cap on the whole line) — the cap only binds near the goal, which is the
weight aimed at today; keeping it current is the minimal, targeted fix for the reported slope bug.

**Rationale.** Resolving by **end date** matches how `derivePeriods` already attributes a period's
`diet_flag` (taken from its ending weigh-in), so rate and flag are read at the same point. The
earliest-Target fallback keeps parity with `currentAsOf` (B-090), so pre-target periods are not
silently drawn flat at 0 when an early Target exists.

**Code (`packages/api` only; web unchanged — it only plots the server series, rule 2).**
`domain/weight/trajectory.ts`: `TrajectoryPeriod` gains `rateKgPerWeek`; the scalar leaves
`TrajectoryInput`; new pure `rateAsOf(targets, date)` + `TargetRate` type. `services/weight-view.ts`:
`WeightViewInput.rateKgPerWeek` → `targetRates: TargetRate[]`; each period's rate is
`rateAsOf(targetRates, endDate)`. `services/weight.ts`: also fetches `targetRepo.list` (keeps
`currentAsOf` for the current `goal_weight`).

**Spec impact:** `spec/logic/weight-periods-trajectory.md §4` (per-period rate paragraph + a second
worked oracle: 1.0 then 0.25 kg/week → 80.0 → 79.0 → 78.5). No DB/schema/API change.

---

## ED-1 / B-096, B-097 — Activity editable on summary/imported days; Complet total stays read-only — RESOLVED (author, 2026-06-07)

**Problem.** After import, all history arrives as **summary** (Partiel) days (Gap 3). Editing the
day's **activity** there failed with **409 `summary_day_readonly`** — a field the user legitimately
edits, blocked by a `readonly` error they never asked for. The user's ask was precise: _"pouvoir
modifier les champs qui sont censés l'être, sans être bloqué par une erreur readonly à la con que
j'ai jamais demandé."_

**Decision (improvement; lift one lock, no DB/schema/API-shape change).**

- **B-096 — lift `summary_day_readonly` on activity.** `activity_level` is editable on every day,
  summary/imported included (Repas + Journal already render the selector; only the API blocked it).
  It may travel in the same PATCH as `summary_kcal`. **Snapshots kept** — editing activity recomputes
  the `constat` (burn/deficit) on read but not the calorie `verdict_auto`; a **past** day keeps its
  frozen `target_snapshot` (CLAUDE.md rule 4: the freeze rule governs _later_ edits to a referenced
  food/target, not a direct edit of the day's own fields).
- **B-097 — triage correction, no code.** The backlog triage framed B-097 as "make the **Complet**
  day's calorie total editable". The author **rejected** that: a Complet day's total is the derived Σ
  of its food lines and is **correctly read-only**. The `409 calories_not_editable` (PATCH
  `summary_kcal` on a detailed day with Σ > 0) **stays**. No manual override, no new column. _(Author,
  2026-06-07: "Sur un jour complet, le champ total calorique n'est pas censé être éditable.")_

**Audit result (the "probablement d'autres champs" check).** The only `readonly`-style locks in the
days service are `summary_day_readonly` (activity on summary — lifted here) and `calories_not_editable`
(Complet total — intended, kept). `comment` and `verdict_override` were already editable everywhere.
The `summary_day_readonly` thrown in `clear()` is left as-is — it is not reachable from the UI (no
"Tout effacer" button on a Partiel day). `ErrorCode.SummaryDayReadonly` stays defined (still used by
`clear()`); the PATCH path simply no longer raises it.

**Code (api only).** `services/days.ts`: `patch` drops the two `summary_day_readonly` throws (combined
`summary_kcal`+`activity_level`, and activity on an existing summary day); `setSummaryKcal` adds
`activity_level` to its `extra` write so a combined Partiel edit applies both. Web unchanged.

**Spec impact:** `spec/api/days-meals-leftover.md` (summary-day activity rule rewritten: editable, no
409), `spec/logic/day-snapshot-verdict.md §9` (editable-fields paragraph; Complet total stays Σ). Gap 3
readonly principle confirmed. No DB/schema/API-shape change.

---

## SX-1 / B-100 — Rolling-card caption: per-window vs_target + two clear lines — RESOLVED (author, 2026-06-07)

**Problem.** Under each Stats rolling card (avg kcal 7/14/30/365 j), the caption packed two
independent metrics on one line — the average's position vs the calorie band and the % of OK days —
read as one ("au-dessus 72% OK"). Worse, the position was computed against the **current** band, so a
long window (e.g. 365 j) spanning older, higher targets read a false "au-dessus" (same family as
B-099).

**Decision (improvement, author 2026-06-07: "pourquoi tu calcules pas par rapport à la cible du
moment ?").** `vs_target` is computed **per window against the targets that actually applied** — the
mean of the per-day **frozen** bands (`target_snapshot`) over the window's logged days, not the
current band. The indicator stays on all four windows and is no longer falsely alarmist. The web
caption is split into **two stacked lines**: the colour-coded position, then "X % de jours OK".

**Code (api).** `domain/stats/util.ts`: `DayStat` gains `band` (the day's frozen `{cal_min,cal_max}`
or null); new pure `meanBand(days)`. `domain/stats/rolling.ts`: `rolling(logged, windows)` drops the
`zone` param and sets `vs_target = vsTarget(avg, meanBand(daysInWindow))`. `services/day-stat.ts` fills
`band` from the snapshot (`cal_max > 0 ? snapshot : null`). `services/stats.ts` `getRolling` no longer
fetches the current zone for the rolling cards (adherence/signals/`target_zone` unchanged — the
Signals "30-day avg vs target" stays vs the current band, out of scope). **Web:** `RollingCards`
caption is two lines (`stats.module.css .rollNote` → column); i18n `stats.rolling.okRate` reworded
("{{rate}} de jours OK" / "{{rate}} of days OK").

**Spec impact:** `spec/logic/stats-adherence.md §2` (per-window `vs_target` + oracle),
`spec/api/weight-targets-stats-settings.md §Stats` (vs_target semantics; shape unchanged),
`specifications/screens/stats.md §A` (two-line caption + per-window target). No DB / no DTO-shape /
no API-shape change.

---

## AC-1 / B-101 — Activity selector: tint the whole control by level (not a dot) — RESOLVED (author, 2026-06-07)

**Refinement of MX-1 / B-085.** B-085 colour-coded the five activity levels via an 8px leading dot.
The author asked to mirror the verdict-list treatment: **colour the whole control by level** — the
trigger badge and every dropdown option — instead of the dot.

**Decision (improvement, web-only; no new token).** The level **tints the whole control**, reusing
the **same non-linear B-085 palette** (Sédentaire `--nok` → Léger `--accent` → `color-mix(--ok 45%,
--accent)` → `color-mix(--ok 75%, --accent)` → Très intense `--ok`): the **trigger badge** gets a soft
background (`color-mix(level 16%, transparent)`) + a level border (`color-mix(level 45%, transparent)`,
like the verdict badge), and **each menu option** gets the same soft background + a 3px **left band**
in the level colour (inset shadow — mirroring the Journal day-state band, JR-1/B-077; no layout shift).
The 8px dot is removed. The **OK/NOK `VerdictBadge` is unchanged**; row height unchanged (the width
shrinks as the dot goes).

**Code (web only).** `components/ActivitySelect/ActivitySelect.module.css` drops `.dot::before`; the
shared `.act` class turns `--act-color` (the level) into the SelectMenu tint vars `--sm-bg` /
`--sm-trigger-border` / `--sm-band`. `ActivitySelect.tsx` passes `${styles.act} ${level}` (was
`${styles.dot} …`). `components/SelectMenu/SelectMenu.module.css` reads those vars on `.trigger`
(background + border) and `.menu button` (background + left-band inset shadow) with **neutral
defaults**, so any other SelectMenu use is unchanged. `SelectMenu.tsx`, `VerdictBadge*` and the
Repas/Journal call-sites untouched.

**Spec impact:** `design/components/metric-cards.md` (Verdict cluster — whole-control tint, no dot),
`specifications/screens/meals.md` + `history.md` (activity selector colour). No new design token; no
DB / API / DTO change. Visual + lint (CSS-only; no dedicated test, per the item's acceptance).

---

## SC-1 / B-111, B-112 — Stats monthly charts: global-average curve, styled tooltip, axes — RESOLVED (author, 2026-06-07)

Post-v1 backlog triage (batch SC-1, two related items on the same two Stats chart components).
**B-111:** `design/components/charts.md` already mandated a **global-average polyline + dots in
`var(--text)`** on the avg-kcal/month chart, but the code only drew the OK/NOK bars (code lagging the
contract). The per-month global mean is a nutrition figure → rule 2 forbids the web from deriving it,
so it must be server-computed. The author also asked for the **styled HTML tooltip** (the B-056
weight-chart card) in place of the native `<title>`. **B-112:** neither monthly chart had axes,
gridlines or a legend.

**Decision (improvement/mixed batch).**

- **`avg_kcal_global`** (additive, server-computed): per month, `mean(day_kcal over ALL logged days)`
  (OK + NOK combined), never null (a month present in the pivot has ≥ 1 logged day). Feeds the global
  polyline. Worked example: OK `1600`, OK `1500`, NOK `1800` → `1633.33…`.
- **Styled tooltip on BOTH monthly charts** (author decision this session, for visual consistency):
  the B-056 styled card now also covers the OK/NOK stacked bars **and** the avg-kcal grouped bars,
  via a transparent per-month **column hit-area** carrying the month's summary. The dense **heatmap
  keeps the native `<title>`**.
- **Axes + gridlines + legend on both monthly charts:** a left value axis (`.axislbl` — day count /
  kcal) with horizontal gridlines (`.gridline`), reusing the weight-chart primitives, plus a `.legend`
  below each chart.

**Rationale:** `avg_kcal_global` only surfaces an existing per-day figure (kcal already on `DayStat`),
no new domain concept and no schema change — honours rule 2 (web renders, never computes). Reusing the
existing `Chart` primitives (`scale.ts`, `Chart.module.css` `.gridline`/`.axislbl`/`.tooltip`/`.legend`,
`ChartTooltip`) avoids duplication and keeps theming correct. Styling both charts (over the narrower
triage scope of the avg-kcal chart alone) was chosen for consistency between the two side-by-side charts.

**Spec impact:** `spec/logic/stats-adherence.md §5` (`avg_kcal_global` def + worked example),
`spec/api/weight-targets-stats-settings.md §Stats` (monthly entry gains `avg_kcal_global`),
`design/components/charts.md` (Tooltips exception extended to both Stats bar charts; Stats bars gain
axes/gridlines/legend), `specifications/screens/stats.md §B–C`. **Code:** shared `dto/stats.ts`
(`MonthlyStat.avg_kcal_global`); api `domain/stats/monthly.ts` (+ test oracle); web
`components/Chart/ChartLegend.tsx` (generalized to a `series` prop) + `WeightChart.tsx` (passes its
series), `features/stats/components/MonthCalorieBars.tsx` + `MonthlyBars.tsx` (polyline, axes/gridlines,
styled tooltip, legend) + i18n `stats.legend.*`. No DB/schema change.

---

## DU-1 / B-109 — Repas: default unit on add follows the item's portion — RESOLVED (author, 2026-06-07)

Post-v1 backlog triage (batch DU-1). Adding a food to a meal via the inline picker always created the
line with `unit:'g'` hard-coded (`mealActions.ts` `pickFood`), so a food normally logged in a portion
(or a garde-manger prefill unit) — and a **recipe**, whose natural unit is one part — still landed in
grams, forcing a manual unit change every time. No contract specified the default unit on add (spec
silent) → this is a contract delta (improvement), not a code bug.

**Decision (improvement, web-only).** The default unit when **adding** a new line follows a precedence
(quantity still starts at 0): **(1)** the garde-manger **pin's prefill unit** if the item is pinned in
that meal's slot — _prefill wins_ (a pin with `unit='portion'` but null `portion_id`, i.e. a deleted
portion, falls back to `g`, mirroring the server prefill); **(2)** else the item's **first named
portion alphabetically** (the picker list is already `label asc`); **(3)** else `g`. **Recipes** need no
special branch: a recipe-derived food carries exactly one auto portion `"portion"` (= batch/servings,
`recipes-derived-food.md §5`), so tier 2 defaults a recipe to **one part**. Re-picking the food of an
_existing_ line is unchanged (keeps that line's unit) — B-109 is about adding.

**Rationale:** the default unit is an **input default**, not a nutrition computation, so resolving it on
the web does not violate rule 2 (the API still receives an explicit `unit`/`portion_id` and snapshots on
save; history untouched). The picker already holds each loggable item's `named_portions` in memory
(`/search/loggable`), and the pantry list is the shared `['pantry']` query (reused via `usePantry`), so
no new fetch, endpoint, schema or DTO is needed. Chosen over a server-side default (would add an endpoint
behaviour and diverge from the existing "client resolves unit, server persists" model).

**Spec impact:** `spec/logic/pantry-pin.md §3` (new "Default unit when adding a food/recipe" precedence

- §5 oracle), `specifications/screens/meals.md` (Quantity-field default-unit note). No `spec/schema` /
  `spec/api` change. **Code (web only):** `features/meals/hooks/mealActions.ts` (pure exported
  `resolveEntryDefaultUnit` + `pickFood` resolves pin/portion, takes the picked item's portions) +
  `mealActions.test.ts`; `useMealsController.ts` (threads `usePantry` pins into the actions);
  `components/InlineFoodSearch.tsx` (passes the loggable item's `named_portions`). No DB/schema/API change.

---

## DZ-1 / B-107 — Repas: mute a quantity-0 food line across the whole line — RESOLVED (author, 2026-06-07)

Post-v1 backlog triage (batch FN-1). A qty-0 line (mainly a garde-manger pinned placeholder) was only
partially dimmed (`.zero .nm`/`.zero .v`), so the qty/unit/grip/📌/× stayed full-contrast and the line
didn't read as inactive. `design/components/data-tables.md` listed `.zero` as merely "(dimmed)".

**Decision (improvement, UX; web-only, CSS only).** A qty-0 line is **muted across the whole line**:
the text cells (name, qty, unit, macros) use `var(--text-faint)`, and the grip / 📌 / × glyphs (which
ignore `color`) are dimmed with `opacity:.45`. It reverts to normal the instant quantity > 0 (the row
already toggles the `.zero` class on `served_quantity === 0`). Reuses existing tokens — no new token.

**Spec impact:** `design/components/data-tables.md` (`.zero` = whole-line muted, detailed) +
`specifications/screens/meals.md` (muted qty-0 line). **Code:** `features/meals/components/FoodLine/
food-line.module.css` (`.zero` extended to `.qty`/`.unit` + `.gripDrag`/`.pin`/`.del`). Test:
`FoodLine.test.tsx` (qty-0 row has `.zero`, qty>0 doesn't). No DB/API/DTO change.

## QC-1 / B-108 — Arithmetic expressions in quantity fields — RESOLVED (author, 2026-06-07)

Post-v1 backlog triage (batch FN-1). Quantity fields accepted only a plain number; the author wanted to
type a calculation (e.g. `950/2`) and have the field store the result. No contract specified input
behaviour → contract delta (improvement).

**Decision (improvement; web-only).** The **quantity** inputs — **Repas food qty + recipe ingredient
qty only** (not weight/measurement fields) — accept an arithmetic expression (`+ - * / ( )` + decimals,
French comma), **evaluated on commit** (Enter/blur/Tab/arrow); the **result replaces the expression**
(no formula kept), e.g. `950/2` → 475. **Invalid** input is **rejected** (previous value kept on Repas;
left as typed on the recipe draft, where the save-time conversion falls back as before). Parsing is a
**safe local recursive-descent evaluator — never `eval`**; the API still receives a plain number, so
rule 2 is intact (input convenience, not a nutrition computation).

**Spec impact:** `design/components/forms-inputs.md` (quantity input accepts an arithmetic expression) +
`specifications/screens/meals.md` + `specifications/screens/recipe.md`. **Code:** new
`lib/format/parse.ts` `evalQuantity` (+ `parse.test.ts`); wired into `features/meals/components/FoodLine/
QtyCell.tsx` (commit evaluates, reject→revert; key handler extracted to keep the line cap),
`features/recipes/modals/IngredientLine.tsx` (blur evaluates) + `draft.ts` `ingredientInput` (safety net
for preview/save). Tests: `QtyCell.test.tsx`, `IngredientBlock.test.tsx`. No DB/API/DTO change.

---

## ABT-1 — "À propos" screen + GET /api/v1/about (app + server/runtime info) — RESOLVED (author, 2026-06-08)

Direct owner request (after the versioning work, ADR-0002). The owner wanted an **À propos** entry in
the account menu — **between Paramètres and Se déconnecter, isolated by a separator on both sides** —
showing "Macronome" + the version, plus a rich set of live **server/runtime** facts ("sois créatif").

**Decision (improvement; api + web; no DB/schema change).** A new **authenticated** read-only endpoint
`GET /api/v1/about` returns `{data: AboutInfo}` — `app` (name, version=`APP_VERSION`, environment),
`runtime` (node version, started_at, uptime, pid), `system` (platform/OS, arch, hostname, CPU model +
cores, load average, total/free memory, host uptime), `process_memory` (rss, heap used/total), and
`database` (PostgreSQL `version()` + `pg_database_size`). The API gathers everything (env + node
`os`/`process` + Postgres `$queryRaw`); the web only renders + formats bytes/durations (rule 2). It is
behind `requireAuth` (exposes host internals to the single owner only); the public readiness probe stays
at `/api/v1/health`. **Privacy:** no secrets, DB connection string, filesystem paths, or dependency tree
(security.md §7/§9). The version reads `0.9.0` in the released image, `dev` locally (consistent with
`/health`, ADR-0002).

**Spec impact:** new `spec/api/system-info.md` (the endpoint), `specifications/screens/about.md` (local
screen spec), `docs/architecture/module-map.md` (about feature + `system-info.md` row). No
`spec/schema`/design-component change (the page reuses the card + key/value table conventions and
semantic tokens). **Code:** shared `dto/about.ts` (`AboutInfo`); api `data/about.ts` (`dbInfo` +
`STARTED_AT`), `services/about.ts`, `http/controllers/about.ts`, `http/routes/about.ts`, mounted in
`app.ts`; web `api/about.ts`, `features/about/{useAbout.ts,AboutPage.tsx,about.module.css,format.ts}`,
route in `router.tsx`, menu entry + two separators in `AccountMenu.tsx`, i18n `menu.about` + `about.*`
(fr/en). Tests: `about.test.ts` (integration: authed 200 shape + 401), `format.test.ts` (bytes/duration).

---

## PM-1 / B-114 — Food macro-label parser ("Parser macro") — RESOLVED (author, 2026-06-08)

**Problem.** Creating/editing a food means typing the 4 per-100 g macros (kcal/L/G/P) by hand off a
grocery-site nutrition table — tedious and error-prone. The author wanted to paste the copied label and
have Macronome deduce the values. No contract specified parsing → contract delta (improvement, functional).

**Decision (improvement; api domain + endpoint + web dialog; no DB/schema change).** A **"Parser macro"**
button under the macro grid on the Aliments add/edit modal opens a paste sub-dialog (textarea). Parsing
is **backend** logic (CLAUDE.md rule 2 — text→numbers is a computation, the web never derives a nutrition
figure): a new **stateless** `POST /foods/parse-label` `{label_text}` → `{data:{kcal_per_100g?,
fat_per_100g?, carb_per_100g?, protein_per_100g?}, warnings?}` or **422** `{error:{code}}`.

**Behaviour decisions (author):**

- **Apply + close direct.** A successful parse fills the found fields and closes the sub-dialog; an
  error keeps it open and writes nothing.
- **Show warnings.** When a value was guessed (kJ→kcal fallback, `kcal_from_kj`), scaled from an
  explicit reference weight (`scaled_from_ref`), or some macros were not found (`macro_missing`), a
  discreet non-blocking note appears on the modal after applying.
- **Fill found, leave missing.** Only macros found are written; a missing line leaves its field
  untouched (no zero, no error). Found values overwrite the field.
- **Reference weight.** Per-100 g/ml as-is; an explicit other weight ("pour 30 g") scales ×100/ref; a
  reconstituted / "après préparation" label is a **hard error** (`reconstituted_label`, dry value
  unknowable); a serving-only reference with no gram weight → `no_reference`; nothing usable →
  `unparseable`.
- **Foods screen only** (not recipes).

**Label recognition (the heart of it, from a survey of real FR/EN tables + the author's 13 pastes).**
Case- and accent-insensitive, singular/plural, FR or EN; comma **or** dot decimals, thousands spaces
(incl. NBSP). Fat ← _Matières grasses / Matière grasse / **Lipides** / Graisses / Fat / Fats_; carb ←
_Glucides / Carbohydrate(s) / Carbs_; protein ← _Protéines / Protéine / Protein(s)_; energy ← _Énergie /
Valeur énergétique / Energy / Calories_ (take kcal; else kJ ÷ 4.184). The **"dont…/of which…"** sub-lines
(saturés, sucres, polyols…) and Sel/Sodium/Fibres/minerals/% columns are **skipped**; the main-macro line's
**first** number is the value. Full rules + the 13 + 7 derived oracles live in the new logic spec.

**Spec impact:** new `spec/logic/macro-label-parser.md` (rules + oracles EX-01…EX-13 + D-1…D-7) +
`spec/api/foods-recipes.md §Foods` (the endpoint + `ParseLabel` payload) + `spec/api/00-conventions.md`
(the 3 error codes) + `specifications/screens/food-db.md` (button + dialog) + `design/components/modals.md`
(parse sub-dialog + `.parsenote`) + `forms-inputs.md` (paste textarea). **Code:** shared
`constants/energy.ts` (`KCAL_PER_KJ`), `dto/food.ts` (`FoodParseLabelRequest/ParseLabel/Response`),
`errors.ts` (3 codes); api new `domain/macro-label-parser/{labels,numbers,parse,index}.ts` + co-located
`parse.test.ts` (the oracles), `services/foods.ts` (`parseLabel`), `http/controllers/foods.ts` +
`routes/foods.ts` (the route), integration `foods.test.ts`; web `api/foods.ts` (`parseLabel`),
`features/foods/useFoods.ts` (`useParseLabel`), new `modals/ParseLabelDialog.tsx`, wired into
`modals/FoodModal.tsx` + `FoodModalFields.tsx`, i18n `foods.parse.*` (fr/en). **No DB/schema change**
(additive API + new domain module only).

---

## ML-1 / Repas — narrow the qty+unit column to widen the food-name column — RESOLVED (author, 2026-06-08)

**Problem.** On the Repas meal lines, ~18–20 px of dead space sat between the food name and its
quantity. The grid reserved a **74 px** qty+unit column (`data-tables.md §62`) — wide enough for a long
unit label — but the unit chip **always renders a short token** (`g`/`ml`/`kg`, or `nb` for a named
portion; `data-tables.md §93/§100`, B-031), so that width was never used and the right-aligned content
left a permanent gap.

**Decision (improvement, UX; web-only, CSS only).** Size the qty+unit column to its **real** content —
the numeric input (unchanged 36 px, so no quantity ever clips) plus the short unit chip — and give the
reclaimed width to the `1fr` **name** column (longer food names now show before ellipsis). Meal column
grid `74px → 54px`; `.qtyCell` gap `3px → 2px`; `.unit` `min-width 18px → 16px`. The quantity input and
its display are untouched. The recipe-builder line grid (instance B, `data-tables.md §81`) is unchanged.

**Spec impact:** `design/components/data-tables.md §62` (meal column grid 74→54 + rationale). **Code:**
`features/meals/components/FoodLine/food-line.module.css` (`.row` grid, `.qtyCell` gap, `.unit`
min-width). No DB/API/DTO change; no behaviour change beyond the column widths.

---

## WV-1 / B-115 — Poids Period-table visual & colour coding — RESOLVED (author, 2026-06-08)

**Problem.** The Poids screen's bottom recap ("Period") table renders 15 numeric columns with
no visual cues (`specifications/screens/weight.md §Period table`), so trends are hard to scan.

**Decision (improvement, UX; web-only).** Layer **server-fact-driven** colour/iconography on the
existing figures — the web only chooses a colour/arrow class from values already on the `Period`
DTO (`GET /weight`); it computes no nutrition figure (CLAUDE.md rule 2 preserved). Three
treatments, **reusing existing tokens — no new token**:

1. **Trend colours.** **Δ** (`delta`): weight ↓ (negative) → green `--delta-pos` + a **▼**;
   weight ↑ (positive) → red `--delta-neg` + a **▲**; 0 → neutral, no arrow. **Écart à la
   trajectoire** (`ecart_trajectoire` = real − trajectory): **below** the trajectory (negative =
   ahead of plan) → green; **above** (positive = behind) → red; 0/null → neutral, no arrow. Same
   sign→colour rule as Δ (lower is "good").
2. **Activity tint.** `avg_activity` is a PAL **multiplier** (×1.2–1.9), so the web buckets it to
   the **nearest of the five canonical levels** (`ACTIVITY_MULTIPLIERS`, `@macronome/shared`) and
   shows the value in an inline pill tinted with the **B-085/B-101 activity palette** (soft bg +
   soft border, Sédentaire `--nok` → Très intense `--ok`). null → plain em dash, untinted.
3. **Deficit & régime.** **Déficit/j** (`deficit_per_day`) is coloured **by sign in all modes**
   (author decision, 2026-06-08): negative (deficit) green, positive (surplus) red, 0/null
   neutral — **régime/Maintien does not change the colour rule** (kept simple; the mode is
   already conveyed by the régime badge). **Régime** (`diet_flag`) becomes a **badge with two
   distinct neutral tints** (author decision; no good/bad judgment): `En régime` (`in_diet`) =
   warm accent tint (`color-mix(--accent …)`), `Maintien` (`not_in_diet`) = neutral grey
   (`--bg-elev-2` / `--text-dim` / `--border`).

**Excluded this run (author decision):** structural readability (zebra striping, frozen first
column, apport/dépense/déficit column grouping) — re-add only if requested later.

**Spec impact:** `specifications/screens/weight.md` (new "Period-table colour coding" subsection)

- `design/components/data-tables.md` (new "Period-table colour coding (Poids, WV-1 / B-115)"
  section). **Code (web-only):** new `features/weight/period-style.ts` (pure `signTone` /
  `deltaArrow` / `activityLevelFromMultiplier`) + co-located `period-style.test.ts`;
  `features/weight/components/PeriodRow.tsx` (apply classes/arrow/pill/badge);
  `features/weight/weight.module.css` (tone, activity-pill palette, régime-badge classes). **No
  DB/schema/API/DTO change** — every figure is already server-computed on the `Period` DTO.

---

## B-117 — AI assistant connection: configurable & verifiable (was inert hook) — RESOLVED (author)

Post-v1 backlog triage. The reserved AI hook (Gap 14 / DEV*PLAN O2) shipped as inert: an
unused `settings.llm_endpoint {url,key?}` and a 501 `POST /advisor/query`. The author wants to
**configure and verify** a remote AI connection now (target: Google Gemini — free and reads
images — via its **OpenAI-compatible** endpoint), while the AI \_uses* wait for a later step.

- **Connection model (replaces `llm_endpoint`).** `settings.ai` = `{ provider:"openai_compatible",
base_url, api_key, tasks:{ dish_photo_macros, meal_suggestions, advice } }` or `null`. Each task
  is `{ model, prompt }`. The three tasks are fixed (photo→macros = vision; meal suggestions and
  advice = text). _(Author: OpenAI-compatible generic — Gemini exposes a compatible endpoint that
  serves text and images, so one code path; no hard Gemini coupling.)_
- **Models chosen live.** The model menus are populated from the provider, fetched server-side via
  `GET /settings/ai/models` (`GET {base_url}/models`). _(Author: live-fetched list.)_
- **Link test = the model fetch.** No dedicated ping/test endpoint: a successful model listing is
  the connection proof; **save does local format validation only** (no provider call). _(Author:
  "validation locale seulement" — reconciled with the live model fetch being the de-facto test.)_
- **API key is a write-only secret.** Stored in `settings.ai.api_key`, **never returned** by the
  API (read DTO exposes `api_key_set:boolean`) and **never logged**; the UI shows "•••• définie"
  and the key is re-entered to change it. Not encrypted at rest in v1 (self-hosted, single owner,
  private volume); encryption at rest is a possible future hardening. _(Author: masked, never
  re-shown.)_
- **Prompts are English-only user scope.** Each task `prompt` is editable, pre-filled from a fixed
  **English** default (`defaultTaskPrompt`, not an i18n key — never translated), defining the
  request scope. The **technical response-format instructions** are **hard-coded in the app** and
  appended at call time (not stored), guaranteeing the return format. _(Author: prompts EN only;
  defaults provisional, to be refined later.)_
- **No AI use in v1.** `advisor/query` and the photo/meals/advice calls stay reserved/501; this
  work delivers configuration + verification only.

**Rationale:** keeps the AI strictly optional and off the critical path (masterplan §3.9) while
letting the owner wire and prove the link ahead of building uses. Reuses the already-reserved seam
(Gap 14) rather than inventing a parallel one; secrets handling mirrors the never-logged rule of
`SESSION_SECRET`/credentials.

**Spec impact:** new `spec/logic/ai-connection.md` (validation, default prompts, redaction, merge,
OpenAI-compatible model listing, oracles); `spec/schema/tables-catalog.md` (`settings.ai` shape,
replaces `llm_endpoint`); `spec/api/weight-targets-stats-settings.md` (`/settings` `ai` redaction +
new `GET /settings/ai/models` + error codes) and `spec/api/00-conventions.md` (reserved-note
update); `design/components/ai-connection.md` (active Paramètres card); `specifications/screens/
settings.md` (Assistant IA section); `specifications/masterplan.md` §3.9; `DEV_PLAN.md` O2 (split
into O2a connection / O2b uses). DTO/error-code work (`settings.ts`, `errors.ts`) and the web card
are implementation, tracked as B-117.

**Amendment (2026-06-09, implementation review).** The author found the connection help too terse
(no step-by-step for the key; the base URL only hinted as a placeholder). Resolved (author-approved):
the Assistant IA card gains (a) a **"Utiliser l'URL Gemini" quick-fill link** under the Base URL
field that one-click fills the Gemini OpenAI-compatible endpoint, and (b) a **step-by-step help
block** (ordered list: AI Studio sign-in → create+copy key → fill URL → fetch models & pick a
model). Web-only + i18n; `design/components/ai-connection.md` updated (Base URL quick-fill + Help
guide). No schema/API/DTO change.

**Amendment 2 (2026-06-09, review).** "Récupérer les modèles" read the _stored_ config, so typing
a URL+key without first clicking Enregistrer returned `ai_not_configured` — confusing. Resolved
(author-approved): the fetch action now **persists the current draft first** (a normal `/settings`
PATCH), then lists models, so the test always reflects the on-screen values; a bad base_url (422)
aborts before the provider call. Web-only; `design/components/ai-connection.md` (§Fetch models) +
`spec/logic/ai-connection.md` (§6a) note the save-then-list order. No schema/API/DTO change.

---

## B-118 — AI dish-photo macro estimate (first AI use, O2b) — RESOLVED (author)

Post-v1 backlog triage. First actual **use** of the AI connection (B-117). On the Repas custom
meal-entry modal, an "Analyse par IA" button opens an image-upload sub-dialog; the configured
`dish_photo_macros` vision model estimates the dish and pre-fills the manual-entry form.

- **Endpoint per task, under `/ai/*`.** `POST /api/v1/ai/dish-photo-macros` (not the generic
  `advisor/query`, which stays reserved/501). Body `{ images:[dataURL], note? }`; reads the stored
  `settings.ai` + the `dish_photo_macros` task (model + prompt). Persists nothing — it returns an
  estimate the client maps into the form. _(Author.)_
- **Aggregate multiple dishes into ONE result.** If the photos show several dishes, the model sums
  them into a single custom entry (combined `dish_name`); the single form is pre-filled. _(Author:
  "un seul total agrégé".)_
- **Always estimate every field.** The model must return a best-estimate for all six values
  (dish name, calories, weight, fat, carb, protein) — never null/omitted. _(Author.)_
- **Prompt = configured scope + user note + hard-coded format.** The request text is the task
  `prompt` (B-117, English), then the optional user note, then an **app-hard-coded** JSON format
  instruction (not stored) that pins the return schema + SI units; images follow as `image_url`
  parts (OpenAI-compatible vision). Response is parsed/validated (markdown-fence tolerant, numeric
  coercion, all fields finite ≥ 0) → `ai_bad_response` on any mismatch.
- **Totals map 1:1.** The custom-entry form stores totals (not per-100 g), so the result fills
  name/kcal/served-weight/fat/carb/protein directly, no conversion (unlike the per-100 g
  label parser, B-114).
- **Blocked-by B-117.** Needs the configured `settings.ai` (provider client, model, key); not
  testable until O2a is implemented. Error codes reuse B-117's four (`ai_not_configured`
  covers a null task model).

**Rationale:** keeps the AI optional and off the critical path (masterplan §3.9) while delivering
the first concrete use; mirrors the proven parse-label pre-fill pattern; the hard-coded format
contract guarantees a parseable return regardless of the user-editable scope prompt.

**Spec impact:** new `spec/logic/ai-dish-photo-macros.md`, `spec/api/ai.md`,
`design/components/ai-dish-analysis.md`; amended `spec/logic/ai-connection.md` (§6b chat/vision op),
`spec/api/00-conventions.md` (per-task `/ai/*` note), `specifications/screens/meals.md` (custom
inline editor), `DEV_PLAN.md` (O2b). DTO `dto/ai.ts` + the web sub-dialog are implementation
(tracked as B-118, deferred until B-117 ships). No schema change (nothing persisted).

**Amendment (2026-06-09, implementation review).** Three author-requested refinements after a real
Gemini call surfaced a model-choice trap (selecting `gemini-*-image`, an image _generation_ model
with free-tier quota 0, returned 429 → `ai_bad_response`):

1. **Image-capable model filter.** The `dish_photo_macros` model picker now lists only image-capable
   models — generation/embedding/audio ids are hidden via a best-effort id heuristic
   (`isVisionModel`, shared `constants/ai.ts`), since the OpenAI-compatible `/models` listing has no
   capability flags. Other tasks' pickers are unfiltered.
2. **Note-only analysis.** `images` relaxed to **0..4** with a "at least one of images/note"
   constraint; a note alone (e.g. "3 tranches de saucisson…") is estimated without any image
   (`spec/api/ai.md`, `spec/logic/ai-dish-photo-macros.md §1/§2`, `dto/ai.ts` refine).
3. **Loading state.** The sub-dialog shows a spinner + busy line and disables inputs during the
   call (tens of seconds for vision) — `design/components/ai-dish-analysis.md`.
   Web + shared + i18n only; no DB/API-shape change (the 429→`ai_bad_response` mapping is unchanged —
   the picker filter prevents the bad pick that caused it).

**Amendment 2 (2026-06-09).** Follow-ups from testing: (a) the **default `dish_photo_macros` prompt**
is reworded to cover the no-image case ("Use the photo(s) when provided; otherwise rely on the
written description …"), and the hard-coded format instruction's "everything visible across the
provided image(s)" → "the whole dish, based on the provided photo(s) and/or written description"
(`constants/ai.ts`, `domain/ai-dish-photo/format.ts`, `spec/logic/ai-connection.md §3`,
`spec/logic/ai-dish-photo-macros.md §3`). Already-stored prompts are unchanged (the user re-applies
via "Réinitialiser" or by editing). (b) the Assistant IA card's action buttons ("Récupérer les
modèles", "Enregistrer", per-task "Réinitialiser") got the same `onMouseDown preventDefault`
focus-steal fix as the URL quick-fill (B-117 Amendment), since the `overflow:hidden` card scrolls
the page when an action button takes focus. Web/shared/spec only.

**Amendment 3 (2026-06-09).** A note-only test intermittently failed with `ai_bad_response`
("réponse inattendue"); measuring the real call showed Gemini returning **HTTP 503 UNAVAILABLE**
("model experiencing high demand") on the free tier — a transient overload, not a client problem.
Two author-requested fixes: (a) **auto-retry** transient upstream failures (500/502/503/504 +
network) a few short attempts before giving up; (b) **clearer errors** — distinguish `ai_rate_limited`
(429) and `ai_unavailable` (5xx) from the generic `ai_bad_response`, and pass the provider's own
message through in `error.details.provider_message` so the UI shows the real reason. Two new error
codes added (`shared/errors.ts`, `spec/logic/ai-connection.md §6a/§7`, `spec/api/ai.md`), with FR/EN
messages for both the Paramètres card and the analysis dialog. Api/shared/web/spec only; no DB/DTO
shape change.

---

## B-119 / B-120 — Localised dish name + Claude connection helpers — RESOLVED (author)

Post-v0.9.3 refinements (author-requested).

- **B-119 — dish_name in the user's language.** The dish-photo result returned `dish_name` in any
  language; it must come back in the user's UI language. `buildDishPhotoMessages` gains a `locale`
  param and appends `Write the "dish_name" in <French|English>.` after the format instruction; the
  ai service resolves it from `settings.locale` (default `fr`). Only `dish_name` is localised; numbers
  stay SI. Contract: `spec/logic/ai-dish-photo-macros.md §2/§5/§7.7`. Api/spec only.
- **B-120 — Claude connection helpers.** Since the link is generic OpenAI-compatible and Anthropic
  exposes an OpenAI-compatible endpoint (`https://api.anthropic.com/v1/`), the Paramètres card gains
  a second quick-fill **"Utiliser l'URL Claude"** and a **"Comment connecter Claude"** help block
  (console.anthropic.com → key → fill URL → fetch models → pick a Claude model; note: billed per
  token). `isVisionModel` already keeps `claude-*` ids. The connection fields were extracted to a
  `AiConnectionFields` sub-component (also clears the prior `AiCard` 80-line warning). Web + i18n +
  `design/components/ai-connection.md` only. No DB/API/DTO change.

**Amendment (2026-06-09).** Testing Claude surfaced an auth mismatch: Anthropic's `/v1/models`
rejects `Authorization: Bearer` (401 "Invalid bearer token") and requires `x-api-key` +
`anthropic-version`; Gemini requires Bearer. Measured: Anthropic returns 200 on both `/models` and
`/chat/completions` with `x-api-key`, and 200 on `/models` when **both** headers are present.
Resolved: the provider now sends **both** header styles on every request (`Authorization: Bearer`
**and** `x-api-key` + `anthropic-version: 2023-06-01`); each provider uses the one it understands.
Generic (no per-host branching). `services/ai-provider.ts` + `spec/logic/ai-connection.md §6`. No
DB/API/DTO change.

---

## LL-1 / B-122 — Aliments & Recettes lists lazy-load all pages — RESOLVED (author)

The Aliments and Recettes list screens fetched a **single page** and ignored the API's
`next_cursor`: `useFoodsList`/`useRecipesList` called `useQuery` once without `limit`/`cursor` and
rendered `data.data` verbatim. The API caps a page at 50 (default) / 200 (max), so any food or
recipe past the first ~50 was **unreachable** by scrolling — a real functional gap on a populated
DB (e.g. after an import).

**Decision (author):** the web consumes **all** pages via **infinite scroll** (load-on-scroll, not
a "load more" button). The two list hooks move from `useQuery` to TanStack Query v5
`useInfiniteQuery` (`getNextPageParam: last => last.next_cursor ?? undefined`, `cursor` as the page
param); the pages flatten `data.pages` and render an `IntersectionObserver` sentinel after the
table that calls `fetchNextPage` until `next_cursor === null`, with a discreet `SkeletonRows`
indicator while a page is in flight. A new reusable `lib/useInfiniteScroll` hook establishes the
pattern. The query keys keep their `['foods']`/`['recipes']` prefix, so the existing mutation
invalidations still match and refetch all loaded pages.

The toolbar **count reflects the rows loaded so far** (it grows as pages load); a true total would
require an API change and is out of scope.

**No API / schema / DTO / domain-logic change** — the backend keyset pagination already existed
(`spec/api/foods-recipes.md`: `limit`+`cursor` → `{ data, next_cursor }`). Contract delta is web +
the two screen specs (`specifications/screens/food-db.md` + `recipe.md`, infinite-scroll behaviour

- "loading next page" state). Web-only.

---

## B-123 — AI meal-proposals (`meal_suggestions` AI use) — decided (feature design package)

Implements the second AI **use** — the `meal_suggestions` task that has shipped only as a reserved
stub since B-117/B-118. On the Repas page a `✨ Proposition IA` popup proposes **3 distinct food
sets** (foods + quantities) that aim to bring the **whole day** into its calorie band + macro
floors/ceiling; the user can apply one or refine it ("I don't have X", "use 2 not 3") and recompute.
Decided across the design package `specifications/features/ai-meal-proposals/` (challenge.md →
decisions.md → spec.md → dev-plan.md); the neutralised decisions are recorded here. Built slice by
slice per that dev-plan; live contracts: `spec/api/ai.md`, `spec/logic/ai-meal-suggestions.md`,
`spec/logic/meal-solver.md`, `spec/schema/tables-catalog.md` (`food.ai_proposable`).

- **D1 — Architecture = hybrid (LLM chef + deterministic solver + code verifier).** The LLM picks
  foods qualitatively and outputs **no quantities**; a pure deterministic solver sets integer
  portion counts / 5 g-step grams to minimise a penalty over the day's targets; the service
  recomputes the day total in code. _Rationale:_ LLMs are unreliable at exact arithmetic and
  constrained optimisation — the solver + verifier make the "fits the targets" guarantee real and
  testable. **The fit is never trusted from the LLM.**
- **D2 — Hard vs soft targets.** Calorie band + protein floor + fat floor are **HARD**; carb
  ceiling is **SOFT**. When the feasible region is empty under indivisible portions, the solver
  returns the **closest fit and states the gaps explicitly** (numeric per target). _Rationale:_ the
  day's OK verdict is calorie-only; protein/fat floors are required nutrition guarantees; carbs are
  the flexible remainder.
- **D3 — Approximation bias = conservative.** When no exact fit exists, bias toward staying
  within/under the calorie band and tolerate a small floor shortfall, all quantified. Encoded as
  the solver's penalty asymmetry (over-band kcal penalised above under-floor macros). _Rationale:_
  a deficit tracker must not overshoot calories to satisfy a macro.
- **D4 — Applying a proposal = direct write.** "Choisir" writes the proposed lines straight into the
  selected meals via the existing `POST /meals/:mealId/entries` flow (materialising the day if
  needed); **plain entries only — no leftover groups, no "IA" chip**; entries stay freely editable.
- **D5 — Multi-meal split.** The LLM assigns each chosen food to one selected meal; the solver fits
  the **day-wide** remaining as one computation (no arbitrary per-meal target split).
- **D6 — Candidate universe = the user's food base** (see D8/D9 for the filter); OK-day history
  guides preference/combinations and variety rather than limiting the pool. Works when history is thin.
- **D7 — No-AI path = disable + link to Settings.** When the assistant is unconfigured the button
  is visible but **disabled** with a Settings hint (mirrors the dish-photo `ai_not_configured` UX).
  **No deterministic-only fallback in v1.**
- **D8 (+ refinement) — Ratings policy.** Exclude `rating = 0` (Bof); prefer 3 > 2 > 1. **Unrated
  foods are eligible and treated as good by default** (not last-resort). Candidate pool keeps
  `rating ∈ {null,1,2,3}`.
- **D9 — Per-food `ai_proposable` toggle.** A boolean `food.ai_proposable` (NOT NULL DEFAULT true;
  migration backfills existing rows true) controls whether a food may ever appear in AI proposals;
  OFF → never proposed. Surfaced in the food add/edit modal as a 3rd column after Visibility
  ("Dispo pour recettes IA", Oui/Non). Candidate pool filters `ai_proposable = true AND rating ≠ 0`.
  _S3 (B-123):_ the visible toggle shipped; spec §6.7's open control-style choice is **resolved to
  the segmented Oui/Non two-button control** (reuses Visibility's `aria-pressed` segmented pattern —
  no new component, no slider).
- **Internal calls.** Stateless server (refine constraints held client-side, re-sent each call);
  **3** proposals, distinct and varied across refines; OK-day history window ≈ 60 days
  (`OK_DAY_HISTORY_WINDOW_DAYS`); **privacy** — the prompt sends only food names/macros/ratings/
  portions, anonymous remaining/entered numbers, an OK-day history sample, and the free-text
  precisions; **never** identity, weight, or BMI.

**Contract delta:** `spec/api/ai.md` (the `POST /ai/meal-suggestions` section), two new
`spec/logic/` files (chef + solver, with the four worked oracles), `spec/schema/tables-catalog.md`
(`food.ai_proposable`), shared DTOs/constants (`dto/ai.ts`, `dto/food.ts`, `constants/ai.ts`,
`constants/tuning.ts`). Out of scope for v1: a deterministic-only fallback proposer, server-persisted
refine history, leftover-group proposals, weight/BMI in the prompt, a batched apply endpoint.

---

## AIP-1 / B-125, B-126, B-127 — Chef day-awareness + >25 g re-proposal exclusion + coherence — RESOLVED (author, 2026-06-09)

The chef (the LLM half of B-123) received only the day-wide **remaining** totals, never the foods
already on the plate. So it re-proposed a food just added manually to the targeted meal (**B-125**),
re-proposed a food eaten earlier the same day (**B-127**), and built internally-incoherent sets
(**B-126** — the prompt asked for coherence but under-delivered with no awareness of what was there).

**Decision (author).** Two complementary, **server-only** mechanisms (no DTO/DB/API-shape/solver
change — the server already has `date` + `meal_ids`):

1. **`ALREADY ON THE DAY` context section** — the foods already entered/eaten on the working day,
   per meal (`{ meal_name, foods: [name × qty] }`), mirroring the OK-day-history wire shape
   (referenced foods resolved by id, custom by name, zero-qty prefill lines skipped). Feeds the chef
   awareness for coherence (B-126) and complementing the plate.
2. **Deterministic day-used exclusion (the hard no-duplication guarantee, prompt-independent).** Sum
   the **consumed grams per `food_id` across the whole day**; any food whose day-total is \*\*strictly
   > `DAY_REPROPOSE_THRESHOLD_G` = 25 g** is **removed from the candidate pool** before assembly (so
   > the chef cannot pick it, and the §6 parse drops it even if hallucinated). Foods used **≤ 25 g**
   > (condiments — oil, spices) **stay proposable\** — this is the author's rule for B-127: "an
   > already-used food is not re-proposed if it exceeds 25 g; below that it may recur." A food summed to
   > 30 g across two meals is excluded; exactly 25 g is kept (rule is *strictly\* greater than 25 g).
   > Custom entries (no `food_id`) are shown for awareness but never excluded.
3. **Default scope prompt strengthened** (qualitative) — account for the foods already on the day,
   never re-propose one eaten in a meaningful amount, and make every set internally coherent. Since
   the prompt is user-editable, the §2 hard guarantee does **not** depend on it: users who customised
   their prompt still get the context section + the pool exclusion.

_Rationale:_ a pure prompt instruction is not reliably honoured by the model, so the no-duplication
rule is enforced deterministically at the pool (the same place `excluded_food_ids` acts); the prompt

- context section add the qualitative coherence the solver cannot express. The 25 g threshold is a
  simple consumed-weight cut that cleanly separates "a real food on the plate" from "a condiment".

**Contract delta:** `spec/logic/ai-meal-suggestions.md` (§2.1 prompt, §2.2 `ALREADY ON THE DAY`,
new §3.1 exclusion + oracle 8) + `spec/api/ai.md` (day-awareness note, no shape change) +
`packages/shared/src/constants/ai.ts` (default prompt) + `packages/shared/src/constants/tuning.ts`
(`DAY_REPROPOSE_THRESHOLD_G = 25`). Code: new pure `domain/ai-meal-suggestions/day-used.ts`
(+ test), `ChefContext.alreadyOnDay`, `assemble.ts` section, `aiSuggestionsRepo.foodNamesByIds`,
service wiring in `services/ai.ts`. No DB/schema/DTO/API-shape/solver change.
