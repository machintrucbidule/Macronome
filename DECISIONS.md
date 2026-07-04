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
  wrapper (the colour map) reused by both call sites. **[Colour values superseded by AC-2/B-152 —
  the menu/dot mechanism and the four-call-site map stand; only the five hues changed.]**
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
--accent)` → `color-mix(--ok 75%, --accent)` → Très intense `--ok`) **[colour values superseded by
AC-2/B-152; the whole-control tint mechanism described here is unchanged]**: the **trigger badge** gets a soft
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

---

## AIP-2 / B-124 — Graceful "already on target" state for AI meal suggestions — RESOLVED (author, 2026-06-09)

When the day was **already on target** (within the calorie band **and** protein/fat floors met), the
assistant refused: the chef (LLM) was called even though there was nothing useful to add and returned
an unusable reply → `502 ai_bad_response` (or a prose refusal). Bad UX.

**Decision (author — option a).** The assistant must **not** refuse; it shows a graceful "déjà dans la
cible, rien à proposer" state — **no proposals, no error**. (Rejected: (b) propose within the remaining
band width; (c) keep refusing.)

- **Detection (pure):** new `isOnTarget(remaining)` in `domain/meal-solver/remaining.ts` —
  `rem_cal_min ≤ 0 && rem_cal_max ≥ 0 && need_protein === 0 && need_fat === 0` (within band + floors;
  carb ceiling soft, ignored). Distinct from "already over" (`rem_cal_max < 0`), which is unchanged.
- **Server short-circuit (before the LLM):** `services/ai.ts` returns immediately
  `{ status: 'on_target', remaining, proposals: [] }` — no candidate pool, **no model call**
  (deterministic, cheaper, removes the refusal).
- **Response discriminator:** `MealSuggestions` gains `status: 'proposals' | 'on_target'` (explicit,
  self-documenting — preferred over inferring from an empty `proposals` array). The normal path sets
  `'proposals'`.
- **Web:** `AiProposalsDialog` renders an `OnTargetStep` (serene "Déjà dans la cible" message, mirrors
  `AppliedStep`) when `status === 'on_target'`; no cards, no error banner. New i18n
  `meals.proposals.onTarget` / `onTargetBody` (fr/en).

_Rationale:_ a graceful 200 (not a 422) keeps the dialog calm and honest — the day genuinely needs
nothing. Short-circuiting before the model avoids a pointless call and the spurious `ai_bad_response`.

**Contract delta:** `spec/logic/meal-solver.md` §1 ("Already on target") + `spec/api/ai.md`
(`status` field + on-target 200 example, explicitly not a 422) + `packages/shared/src/dto/ai.ts`
(`MealSuggestionsSchema.status`) + `specifications/features/ai-meal-proposals/spec.md`. No
DB/schema/solver change. Code: `isOnTarget` + service short-circuit + DTO field + web `OnTargetStep`.

## B-129 — AI dish-photo default prompt leans pessimistic — RESOLVED (author, 2026-06-09)

The **default** scope for the `dish_photo_macros` task ("Photo → estimation des macros") asked the
model to estimate macros/calories with no error-direction guidance. For nutrition tracking, an
**under**-estimation (eating more than logged) is worse than a slight over-estimation.

**Decision (author).** The **default** prompt now instructs the model to keep the estimate realistic
**but, when uncertain, lean to the pessimistic side — prefer a slight over-estimation of calories and
macros over an under-estimation.** Only the **default** constant changes; a user's _saved_ prompt is
left to them (the per-task "Réinitialiser" seeds this new default).

- The verbatim wording lives in `packages/shared/src/constants/ai.ts` (single source of truth — it
  seeds new configs and powers "Réinitialiser"; consumed by the `api` seed/merge and the web reset),
  per `ai-connection.md` §3 (prompts are provider-facing, **English only**, never translated).
- The hard-coded response-format contract (`ai-dish-photo-macros.md` §3) is **unchanged** — the bias
  belongs to the editable _scope_, not the fixed format clause.

**Contract delta:** `packages/shared/src/constants/ai.ts` (default string) + `spec/logic/
ai-dish-photo-macros.md` §1 (note the default leans pessimistic). No DB/schema/API/DTO change. Test:
`packages/shared/src/constants/ai.test.ts` asserts the default carries the pessimistic-bias wording
(also closes the prior `dish_photo_macros` test gap).

## B-130 — Assistant IA moved to its own account-menu page — RESOLVED (author, 2026-06-09)

The AI connection config (link + per-task model/prompt blocks + help) lived as one card inside
**Paramètres** (`features/settings/components/AiCard.tsx`). As the AI surface grows it deserves its
own home.

**Decision (author).** Add an **"Assistant IA"** entry to the account menu **between Contenants and
Paramètres**, opening a **dedicated page** (`/assistant-ia`) that holds all the former
Paramètres → Assistant IA content; **remove** that section from Paramètres.

- **Web:** new `features/settings/AiAssistantPage.tsx` (kept in the `settings` feature folder so it
  reuses `settings.module.css`, `AiCard`, `useAiConnectionForm` with no cross-feature import). It
  owns the page **title + lead**; `AiCard` therefore drops its own duplicate `.ch` header and
  `.aiIntro` paragraph and becomes the pure connection/tasks/help body. New `/assistant-ia` route
  (`app/router.tsx`) + `NavLink` (`app/AccountMenu.tsx`, label reuses the existing `settings.ai.title`
  key — no new i18n string). `<AiCard />` removed from `SettingsPage`.
- No behaviour change to the AI config itself (same fields, fetch-models link test, save flow).

**Contract delta:** `specifications/screens/settings.md` (AI section removed → pointer) + new
`specifications/screens/ai-assistant.md` (dedicated page) + `design/components/ai-connection.md`
("Hosting page" note + card shell no longer owns the title/intro). No DB/schema/API/DTO/logic change.

## EX-1 / B-132 — Per-page CSV export (Journal + Poids) — RESOLVED (author, 2026-06-09)

The only export was the IMP-1 **JSON** account envelope in Paramètres; there was no way to pull the
Journal or the weigh-in history into a spreadsheet.

**Decision (author).** A top-right **"Exporter CSV"** button on **Journal** and **Poids**:

- **Journal:** one recap row **per logged day, all years** —
  `date, calories, fat, carb, protein, verdict, activity, comment`.
- **Poids:** one row **per weigh-in, full history** — `date, weight_kg, waist_cm, diet_flag, note`.

Decided this session: **recap rows** (not a per-food dump) and **standard CSV in English** — comma
delimiter, dot decimals, English headers, **canonical values** (verdict `OK`/`NOK`, activity key
e.g. `sedentary`, diet `in_diet`), UTF-8. Because the values are canonical (no localised labels), the
CSV is generated **server-side**, consistent with the existing export layer and CLAUDE.md rule 2 —
no localisation/label duplication into the backend, no client all-years fetch loop.

- **API:** pure `services/data/csv.ts` (`toCsv`, RFC-4180 escaping) + `services/data/export-csv.ts`
  (`buildJournalCsv` / `buildWeightCsv` + pure field mappers). The Journal builder reuses the screen's
  day mapping via new `journalService.listAllLogged` (over a new `dayReadRepo.readAll` — `readYear`
  without the year filter), so the CSV can never drift from the Journal; kcal/macros rounded as the
  screen renders them, summary days leave the macro cells blank. The Weight builder reuses
  `weightRepo.findAll` (already full history). New thin controllers + routes
  `GET /data/export/journal.csv` and `/data/export/weight.csv` (`text/csv` attachment, no body/query,
  no CSRF — read-only).
- **Web:** two `downloadFile` wrappers in `api/data.ts` (reuse the existing Blob+anchor helper); a
  ghost export Button in `JournalHeader` / `WeightHeader`; a dismissible warning banner on failure.

**Contract delta:** `spec/api/data-export-import.md` (the two CSV endpoints) +
`specifications/screens/history.md` + `weight.md` (export affordance + columns). No DB/schema/DTO
change. Tests: unit `export-csv.test.ts` (serializer + mappers, escaping, null/canonical handling) +
integration `data-export-csv.test.ts` (all-years Journal, full weigh-in history, user-scoping).

## UR-1 / B-133 — Repas line-level undo/redo (Ctrl+Z / Ctrl+Y) — RESOLVED (author, 2026-06-09)

The Repas screen had no undo — a mis-typed quantity, an accidental delete or a bad reorder could
only be fixed by hand.

**Decision (author).** Add **Ctrl+Z / Ctrl+Y** (and **Cmd** / **Ctrl+Shift+Z** on mac) undo/redo over
recent **line-level** edits on the open day, plus visible **↶ ↷** buttons in the controls row. Two
decisions taken this session: (1) **include pin/unpin** in scope, accepting that pin/unpin is a
_global_ garde-manger op whose qty-0-line cascade touches today + future days; (2) provide **both**
keyboard shortcuts **and** the toolbar buttons (disabled when nothing to undo/redo). History is
**local** (lost on refresh / day navigation), **≥ 100 steps**.

- **In scope (recorded):** add food, remove food, change quantity, change unit, pin/unpin, reorder.
  **Excluded:** day-level ops (Tout effacer / Copier hier / Complet⟷Partiel) + comment/activity/verdict
  - leftover + cook-mode batch.
- **Why server-reconciliation:** Repas edits are **not** optimistic — each mutation invalidates
  `['day',date]` and the refetch is the source of truth. So undo/redo **re-issue the inverse mutation**
  through the existing entry/pin/reorder endpoints (no new API). Re-creating a deleted line yields a
  **new server id**, handled by an **id-map** so later/earlier ops resolve across arbitrary sequences.
- **Design (web-only):** three pure cores under `features/meals/history/` — `historyStack` (past/future,
  clear-redo-on-record, 100-cap), `opReconcile` (op → ordered mutation intents, with the pin/unpin
  branch: undo of an unpin re-creates + re-pins a qty-0 line that unpin removed, via a `@created`
  token), `idMap` — plus the thin async `useMealHistory` hook (executes intents via `useDay`, advances
  the stack only on success, surfaces the existing error banner on failure, resets on date change) and
  `useUndoRedoKeys` (document keydown, bails inside inputs/dialogs). `mealActions` records each tracked
  edit (line actions split into `lineActions.ts` to stay within the size caps); the ↶ ↷ buttons read
  the controller's `undo/redo/canUndo/canRedo` (passed as props to `MealsControls`).
- **Documented imperfect inverse:** for a pin/unpin on a qty-0 placeholder line the cross-day pantry
  cascade re-runs on undo — the open day is restored faithfully, other days follow the pantry model.

**Contract delta:** `specifications/screens/meals.md` (undo/redo affordance + scope + caveat). No
DB/schema/API/DTO change. Tests: `historyStack.test.ts` + `opReconcile.test.ts` (pure cores —
push/clear/cap, per-op inverses incl. the qty-0 pin re-create, id resolution).

## RF-1 / B-136 — Raffiner: type the pinned quantity directly — RESOLVED (author, 2026-06-09)

On the AI meal-proposals **Raffiner** popup each line's pinned quantity was a **read-only** value
between `−` / `+` stepper buttons; reaching a target (e.g. 250 g) took many clicks.

**Decision (author).** The quantity is now **editable by direct entry** (type a value) in addition to
the `−` / `+` stepper. Typing sets the pin's `count` directly, **clamped by the same rules** as
stepping (portioned 1..`MAX_PORTION_COUNT`, portionless `≥ PORTIONLESS_GRAM_STEP` g; rounded to an
integer, no forced multiple). The pin model (`PinnedLine`) and the request body (`constraints.pinned[]`
→ `grams`) are **unchanged** — only the input affordance is new.

- **Web-only:** new pure `setPinnedCount(line, value)` in `logic/refineConstraints.ts`; `RefinePanel`'s
  read-only value becomes a small digits-only `PinQtyInput` (local buffer, commit on blur/Enter, re-sync
  on a − / + press), with a `g` suffix (portionless) or `×` prefix (portioned). New i18n
  `meals.proposals.refine.qtyLabel` (aria-label) + a `.stepInput` style.

**Contract delta:** `specifications/features/ai-meal-proposals/spec.md` §2.6 + `dev-plan.md` (S11 note).
No DB/schema/API/DTO/domain change. Tests: `refineConstraints.test.ts` (`setPinnedCount` clamp/round)

- new `RefinePanel.test.tsx` (typing pins the line at the value; the stepper steps from it).

## DB-1 / B-134 — client display-only day rollover at 03:00 — RESOLVED (author, 2026-06-09)

`todayIso()` (Repas default day) and `currentYear()` (Journal default year) used the raw local
`new Date()`, so opening the app at 00:30 landed on the new calendar day while the user was still
logging the previous one.

**Decision (author).** Before **03:00 local** the client treats the **previous calendar date** as the
default day on **Repas** (and the prior year on **Journal**). **Display-only** — the user can still
navigate to the real date, and the server stays calendar-based: the frozen/live boundary, stats
future-day exclusion and verdict snapshots are **unchanged** (no domain-engine change; this dropped
the item from a potential critical-correctness change to UX).

- **Web:** new pure `lib/effectiveDay.ts` (`DAY_ROLLOVER_HOUR = 3`, `effectiveTodayIso(now)`); the two
  existing helpers delegate to it (`meals/format.ts todayIso`, `journal/format.ts currentYear`), so the
  Repas default day + `isToday` + calendar marker and the Journal default year all roll over together.
- **Scope = Repas + Journal** (the decided scope). Stats' own `currentYear()` and the Poids modal's
  local `todayIso` are intentionally **left calendar-based** (out of scope).

**Contract delta:** `spec/logic/00-conventions.md` (new "Dates & day boundary" note, display-only) +
`specifications/screens/meals.md` + `history.md`. No DB/schema/API/DTO/domain change. Test:
`effectiveDay.test.ts` (before 03:00 → previous date; ≥ 03:00 → same; month/year boundary rollover).

## JM-1 / B-135 — Journal L·G·P macros column-align across rows — RESOLVED (author, 2026-06-09)

The three macro figures rendered as space-separated `<span>`s in one cell, so they didn't line up
between rows.

**Decision (author).** Render the three L·G·P values as **fixed-width, right-aligned, tabular-nums
slots** inside the single Macros cell, keeping the L·G·P order and per-macro colours. Cosmetic, CSS-led.

- **Web:** `JournalRow` wraps the values in a `.macros` flex container; each value gets a shared `.mVal`
  width slot alongside its `.mFat`/`.mCarb`/`.mProt` colour class (`journal.module.css`). The "—"
  no-detail case is untouched. Single Macros column + header unchanged.

**Contract delta:** `specifications/screens/history.md` + `design/components/data-tables.md` (§Macro
cells). No DB/schema/API/DTO change. Cosmetic → visual + lint (no dedicated test).

## RW-1 / B-137 — recipe "Poids du lot": persisted auto-weight toggle — RESOLVED (user, 2026-06-10)

Editing an existing recipe left "Poids du lot" **frozen**: `initialRecipeDraft` loaded a non-empty
`batch`, so B-051's live-tracking (`batch === ''` proxy) never fired on the edit path. The schema had
**no auto-vs-manual flag**, and a custom cooked weight is a documented, legitimate case
(`recipes-derived-food.md` §6), so blindly re-tracking Σ would have silently dropped custom values.

**Decision (user).** Persist the auto-vs-manual state and **replace the "réinitialiser" button with a
"Poids auto" toggle** — **ON** ⇒ the field is greyed and always equals the live ingredient sum (the
server keeps `total_batch_grams` = Σ on every save **and** parent-cascade rebuild); **OFF** ⇒ the field
is enabled and purely manual. **Supersedes** B-051's `batch===''` proxy + "réinitialiser" affordance.
Migration backfill (user): existing recipes become **auto where the stored weight equals the current
ingredient sum** (never customised → bug fixed retroactively), manual otherwise.

- **Schema/DB:** `recipe.batch_weight_auto boolean NOT NULL DEFAULT false` + backfill migration.
- **API:** `POST/PATCH /recipes` accept `batch_weight_auto` (`true` + `total_batch_grams` together
  → 422; create default = `true` iff `total_batch_grams` absent; PATCH keeps the stored state when
  absent, an explicit `total_batch_grams` flips to manual); Summary/Full expose the flag;
  `buildAndPersistDerived` refreshes batch = Σ for auto recipes (covers the nested-recipe cascade).
  `POST /recipes/preview` unchanged (an auto draft omits `total_batch_grams`).
- **Web:** `RecipeDraft.batchAuto`; YieldPanel "Poids auto" toggle (segmented pattern), disabled
  input showing the live preview Σ when ON, seeded with the displayed value when switched OFF.

**Contract delta:** `spec/schema/tables-catalog.md` + `spec/api/foods-recipes.md` +
`spec/logic/recipes-derived-food.md` §3/§6 + `specifications/screens/recipe.md` +
`design/components/forms-inputs.md`. Tests: integration (auto re-tracks on ingredient PATCH, manual
round-trip, both-present 422, cascade refresh) + web (`YieldPanel`, `draft` body builders).

## GM-2 follow-up — pantry prefill unit in the export/import envelope — RESOLVED (user, 2026-06-10)

GM-2 (B-092/093/094) added `pantry_item.unit` + `portion_id` (the garde-manger prefill unit) but the
IMP-1 export/import envelope was never updated, so an export → wipe → import silently reset every pin's
prefill unit to `g` (and dropped its portion). The envelope (`spec/api/data-export-import.md` `pantry_items`
row, `shared/dto/data.ts` `PantryItemSchema`, `services/data/export.ts`, `data/repositories/data-import.repo.ts`)
now carries `unit` + `portion_id`. The schema fields are **optional with defaults** (`unit → 'g'`,
`portion_id → null`) so pre-fix envelopes still import (restored as `g`). No DB/migration change (the columns
already exist). Test: `test/integration/data.test.ts` round-trip now seeds a non-default prefill unit and
asserts it survives. Completes GM-2's contract surface (no new B-number).

## Export/import envelope audit — `food.ai_proposable` + anti-omission guard — RESOLVED (user, 2026-06-10)

A full column-by-column audit (16 Prisma tables vs `export.ts` vs `DataExportEnvelopeSchema` vs
`data-import.repo.ts`) after the RW-1/GM-2 silent gaps found **one more omission**: `food.ai_proposable`
(B-123 "Dispo IA"). It was exported/validated/imported nowhere, so an export → wipe → import reset every
food to `ai_proposable = true`, losing any food the user excluded from AI proposals. Now carried in the
envelope (optional+default `true` so pre-B-123 envelopes still import). All other non-exported columns are
**intentional**: `updated_at` everywhere (regenerated), `owner_id`/`user_id` (re-pointed on import), and
`app_user` identity/credentials (`id`/`username`/`password_hash`/`created_at`).

**Anti-omission guard (user decision: full).** Root cause of the recurrence: the round-trip test only catches
an omission when the fixture uses a **non-default** value (`g`, `true` hid the bugs). Two guards added:

- **Coverage gate** — a Prisma-DMMF ↔ envelope test (`packages/api/src/services/data/export-coverage.test.ts`)
  asserts every scalar column of every exportable table is either in `DataExportEnvelopeSchema` or in an
  explicit, documented exclusion whitelist (`updated_at`, `owner_id`, `user_id`; `app_user` identity). A new
  column that escapes the envelope **fails the build** — no human vigilance required.
- **Strengthened round-trip** — `data.test.ts` seeds non-default values on the loseable flag columns
  (`ai_proposable = false` alongside the GM-2 `unit = 'ml'`) and asserts they survive export + restore.

No DB/migration change. Completes the IMP-1 envelope's coverage (no new B-number).

## Mobile-responsive S1 — responsive type layer + `--bp-phone` — RESOLVED (user, 2026-06-10)

First slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`,
spec §1). A **mobile-only** `@media (max-width: 560px)` `:root` override bumps the type scale
toward native-mobile norms (floor 12px, body 16px: `--fs-9/10 → 12`, `--fs-11 → 13`,
`--fs-12 → 14`, `--fs-13 → 16`, … `--fs-24 → 26`), keeping micro-labels legible and inputs
above the iOS focus-zoom threshold. **Desktop impact: none** — the block is inert ≥561px and
no fixed sizing token (`--tap`, `--appbar-h`, `--control-h`, `--avatar`, column widths) is
touched. A doc-constant `--bp-phone: 560px` is added (a custom property can't be referenced in
a media-query condition, so the literal `560px` is repeated in each `@media`; the token exists
for documentation/JS use). Caveat: components that hard-code px instead of `var(--fs-*)` (meal
food-line `.nm`/`.v`) are intentionally unaffected — they get explicit mobile sizes in S4.

**`tokens.css` reconciliation (user decision).** The app stylesheet
`packages/web/src/styles/tokens.css` (the file rendered in the browser) is the **reference**;
the design-contract copy `design/tokens.css` had drifted in formatting only (Prettier vs.
hand-authored, identical values). It was reformatted to match the app copy **byte-for-byte**
(cosmetic, no value change, not loaded by the app → zero rendering impact) before adding the §1
block, so the two are now truly byte-identical per `CLAUDE.md`.

Contract delta: `packages/web/src/styles/tokens.css` + `design/tokens.css` (the §1 block +
`--bp-phone`; byte-identical) + `design/tokens.md` (mobile type layer note + `phone` breakpoint
row). No backend/schema/runtime change; no new tests (responsive CSS verified by inspection at
breakpoints per the feature dev-plan).

## Mobile-responsive S2 — overlay foundations (Modal mobile variants + `useIsMobile`) — RESOLVED (user, 2026-06-10)

Second slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`,
spec §3 + §0.1/§0.2). It lands the **overlay foundations** four later slices consume, plus the
viewport hook that drives every render-switch — **dormant** for now (no consumer until the
account sheet in S3).

- **`useIsMobile()`** (`packages/web/src/lib/useIsMobile.ts`): a `matchMedia('(max-width: 560px)')`
  hook (subscribes to `change`). Client-only SPA, so no SSR concern. **Defensive:** returns
  `false` when `window.matchMedia` is unavailable (jsdom), so existing modal-rendering tests stay
  green without a global mock.
- **`Modal` mobile variants**: a new **`mobile?: 'fullscreen' | 'sheet'`** prop, **separate from
  `size`**. `size` keeps controlling the desktop width (untouched); `mobile` declares the ≤560px
  presentation. **Design decision:** a separate prop (not new `size` values) is the only
  desktop-inert design — a modal's desktop width must be preserved while its mobile shape changes
  (e.g. the recipe builder is `lg` on desktop but `fullscreen` on mobile; the food sheet is `md`
  on desktop but also `fullscreen`). `fullscreen` = `100vw × 100dvh` takeover with a title+Close
  top bar (mandatory — no reachable scrim outside), scrollable body, safe-area inset; `sheet` =
  bottom-anchored, rounded top, slide-up, `max-height: 90dvh`, safe-area inset. Confirmations keep
  the centered dialog (overlay taxonomy, spec §0.2).

**Desktop impact: none** — the variant is gated by `useIsMobile()` (false ≥561px) **and** its CSS
is scoped inside `@media (max-width: 560px)` (double guarantee); with no `mobile` prop set, every
existing modal is byte-identical on desktop **and** mobile.

Contract delta: `packages/web/src/components/Modal/Modal.tsx` + `Modal.module.css` (the two
variants + close button); new `packages/web/src/lib/useIsMobile.ts` (+ `useIsMobile.test.ts`, the
one justified logic test — layout is verified by inspection); `design/components/modals.md`
(§Mobile variants + overlay taxonomy). No `tokens.css`/backend/schema change.

## Mobile-responsive S3 — mobile shell (bottom nav + app-bar title + account sheet + FAB) — RESOLVED (user, 2026-06-10)

Third slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`,
spec §2). It lands the **mobile app shell** — the most visible phone win (the desktop top
text nav overflows a 360px screen) — and is consumed (bottom bar + page bottom-padding) by
every later screen slice; the `Fab` it creates is wired later (S6/S7/S8).

- **Mobile app-bar title** (≤560px): the appbar swaps the **wordmark** for the **current
  screen title**, derived from the route inside `AppShell` (a `pathname → i18n-key` map — no
  feature page is edited, keeping the slice desktop-inert). The primary nav `.nav` and the
  theme segmented toggle are hidden ≤560px (the theme toggle moves into the account sheet).
- **`BottomNav`** (`app/BottomNav.tsx` + `.module.css`, new): fixed bottom tab bar, the 6
  primary routes (Repas · Journal · Poids · Aliments · Recettes · Stats) as icon + short
  label, active in `--accent`, safe-area inset, `display:none` ≥561px. Repas lit on both `/`
  and `/day/:date` (B-014), reusing the top nav's `mealsActive` rule. **Design decision:** the
  bar height (56px) and the matching mobile page bottom-padding are a **layout literal**, not a
  new token — `tokens.css` is owned by slice S1 and not edited here; the z-index uses
  `calc(var(--z-appbar) - 1)` (between `--z-sticky-sub` and `--z-appbar`), no new token.
- **Account menu → bottom sheet** (≤560px): `AccountMenu.tsx` becomes a `useIsMobile()`
  render-switch — desktop keeps the **exact `<details>` dropdown untouched**; mobile renders an
  avatar button opening a `Modal mobile="sheet"` (the S2 sheet variant's **first consumer**)
  holding the theme toggle + the 7 secondary destinations as `--tap` rows.
- **`Fab`** (`app/Fab.tsx` + `.module.css`, new): floating "+" (props `onClick` + `label`),
  bottom-right above the bottom bar, safe-area aware, `display:none` ≥561px. **Created but not
  rendered anywhere this slice** (placed by each screen in S6/S7/S8), so `AppShell.*` is never
  re-edited after S3.

- **Mobile horizontal-overflow safety net** (`AppShell.module.css` `.root`, ≤560px:
  `overflow-x: clip`): a **measured fix** for a bug found while testing S3 on a phone — the bottom
  nav appeared only after scrolling to the bottom, and the account sheet's scrim drifted
  down-and-right. Diagnosis (live DOM inspection): **no** ancestor of the shell carries a
  containing-block trigger (`transform`/`filter`/`contain`/`will-change`) — the only transforms are
  the leaf `.tick` brand marks — so `position:fixed` correctly targets the layout viewport. The real
  cause is that screens not yet mobile-adapted (Repas's dense grid, wide tables) **overflow
  horizontally** at ≤560px; on mobile that **expands the layout viewport**, so every `position:fixed`
  element then references the enlarged viewport. (A portal to `body` would **not** fix this — it
  references the same enlarged viewport.) `overflow-x: clip` on the shell root contains the overflow
  so the layout viewport stays equal to the visual viewport; `clip` (not `hidden`) creates **no**
  scroll container — the sticky appbar / table headers keep sticking — and **no** containing block —
  the fixed `BottomNav` stays viewport-pinned and unclipped. Owner decision (2026-06-10): the global
  safety net over the page-by-page alternative. **Interim cost (flagged, not silent):** content
  wider than the screen is clipped (no side-scroll) on un-adapted pages until each page's slice (S4
  Repas, S5–S8 lists) reflows it.

- **Focus animated overlays with `preventScroll`** (`useFocusTrap.ts`): a **measured fix** for a
  glitch found while testing S3 on a phone — opening the account sheet, the panel "rose too high
  then came back down" (every open, mobile only — Chrome + Firefox mobile, worse on Firefox; **not**
  reproducible on desktop). Root cause: the focus trap moved focus into the panel on open with a
  bare `.focus()`, which makes the browser **scroll the focused element into view**; because the
  sheet is mid slide-up (partly off-screen) at that instant, the scroll chases its transient
  position and fights the animation → the oscillation. Frame-by-frame extraction of a phone screen
  recording (ffmpeg) confirmed the panel's top oscillating while its resting position stayed
  correct. Fix: focus with `.focus({ preventScroll: true })` (open + the Tab-cycle calls). The
  slide-up animation and the panel geometry were **never** the problem — `Modal.tsx`/`Modal.module.css`
  are unchanged from S2. **General rule (documented in `modals.md` for future overlays):** any overlay
  that animates in must focus with `preventScroll`. _(Three earlier hypotheses — a sticky-in-transform
  header ghost; a `fixed`-in-sticky-ancestor layering issue "fixed" by portaling to `<body>`; then an
  `animation-fill-mode`/anchor rework — were each tried and **reverted** after measurement disproved
  them; recorded so the dead ends aren't re-explored.)_

**Desktop impact: none** — every new rule is `@media (max-width: 560px)`, every new DOM node is
`display:none` ≥561px (absent from layout + tab order), and the account sheet is a render-switch
that returns the unchanged `<details>` dropdown ≥561px. The theme toggle is hidden on mobile by
wrapping it in a span styled in `AppShell.module.css` — `ThemeToggle.*` is not edited.

Contract delta: `packages/web/src/app/AppShell.tsx` + `AppShell.module.css` + `AccountMenu.tsx`;
new `packages/web/src/app/BottomNav.tsx` (+ `.module.css`) and `Fab.tsx` (+ `.module.css`);
`packages/web/src/components/Modal/useFocusTrap.ts` (the `preventScroll` fix above — the only
change in the `Modal` dir; `Modal.tsx`/`Modal.module.css` are unchanged from S2); new
`design/components/bottom-nav.md` + `design/components/mobile.md`; amendments to
`design/components/top-nav.md` (mobile account sheet + a doc-accuracy flag on its unimplemented
≤900px nav-hide claim) and `design/components/modals.md` (sheet `fill-mode` requirement). No
`tokens.css`/backend/schema change; no new tests (responsive CSS verified by inspection at
breakpoints; the `useIsMobile()` logic test exists from S2).

## Mobile-responsive S5 — Journal mobile cards + shared list chrome — RESOLVED (user, 2026-06-10)

Fifth slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`,
spec §4.1–4.2). The Journal screen (`/history`) rendered only the dense desktop `JournalTable`,
unusable on a phone. S5 introduces the **shared mobile list chrome** (consumed read-only by the
three later list slices) and the **Journal card view**, both selected by a `useIsMobile()`
render-switch — desktop renders the **exact existing** `JournalHeader` + `JournalTable` tree,
untouched.

- **Shared list chrome** (`packages/web/src/components/ListChrome/*`, new): `ListToolbar` (sticky
  under the app bar — `top: var(--appbar-h)`, `--z-sticky-sub`, `--bg`, bottom `--border` — with
  a `leading` slot + trailing actions), `SortSheet` ("Trier", a `Modal mobile="sheet"` listing the
  screen's sort keys + active direction, calling the screen's existing `onSort(key)` so it is the
  phone equivalent of clicking a `SortableTh`), and `OverflowMenu` ("⋯", a sheet of secondary
  actions). Generic over the screen's sort-field union; **created here with its first consumer
  (Journal) and consumed read-only by Recettes (S6), Aliments (S7), Poids (S8)** — the **Filtres**
  sheet of the same family joins in S6. Reuses the S2 Modal `sheet` variant + existing tokens
  (`--tap`, `--r-md`); **no new token**, `tokens.css` (owned by S1) untouched.
- **Journal mobile** (`packages/web/src/features/journal/`, new `JournalMobile`, `JournalCards`,
  `JournalCard`, `JournalDaySheet`, `journal-mobile.module.css`; render-switch in `JournalPage.tsx`):
  a **card per day** (date + dow, calories, static verdict pill, L·G·P macros, activity, comment),
  keeping the JR-1/B-077 day-state band; the **year selector + legend** stay (legend below the
  sticky toolbar), **Export CSV** moves into the "⋯" sheet (spec §4.2, **superseding** the
  mockup's visible Export button). Tapping a card opens a **bottom-sheet day editor** reusing
  `VerdictBadge`, `ActivitySelect`, `CommentCell` and the **same `PATCH /days/:date`** mutation as
  the desktop row (kcal field shown only on summary/empty days, as `editable_kcal`). The desktop
  `JournalTable`/`JournalRow`/`JournalHeader`/cells are **not edited**.
- **"Ouvrir la journée" (owner decision, 2026-06-10).** On desktop a row's date/macros cells
  navigate to that day's Repas; the mobile editor sheet would otherwise drop that affordance. The
  sheet therefore carries an explicit **"Ouvrir la journée"** action (`navigate('/day/:date')`) so
  no desktop capability is lost on mobile. _(Owner chose to add the link rather than rely on the
  Repas tab + date navigation.)_

**Desktop impact: none** — the render-switch returns `false` ≥561px → the literal current
`JournalHeader` + `JournalTable` tree; the mobile components never mount on desktop. No
behaviour, sort, or PATCH path changes; the mobile edits round-trip through the same mutations.

Contract delta: new `packages/web/src/components/ListChrome/` (`ListToolbar.tsx`, `SortSheet.tsx`,
`OverflowMenu.tsx`, `list-chrome.module.css`, `index.ts`); new `features/journal/components/`
`JournalMobile.tsx`, `JournalCards.tsx`, `JournalCard.tsx`, `JournalDaySheet.tsx` +
`features/journal/journal-mobile.module.css`; render-switch wiring in `features/journal/JournalPage.tsx`;
i18n `list.*` (sort/more) + `journal.openDay` in `en.json`/`fr.json`; amendment to
`design/components/data-tables.md` (row→card + shared list chrome). No `tokens.css`/backend/schema
change; no new tests (responsive CSS verified by inspection at breakpoints; the `useIsMobile()`
logic test exists from S2).

**Refinements (owner feedback, 2026-06-10).** Five tweaks after the first review, all still
desktop-inert:

- **Day-state legend omitted on mobile.** The Complet/Partiel/Rien legend is dropped from the
  Journal card view; the **card colour cues carry the meaning** instead (next two points). The
  desktop `JournalHeader` legend is unchanged.
- **Calories tinted by verdict.** The card's calorie total is coloured by the day's effective
  verdict — green `--ok` (OK) / red `--nok` (NOK), default colour when no verdict — the **same
  rule as the verdict badge** (owner: "comme ok/nok, même règle"). The "kcal" unit stays dim.
- **Activity tinted by level.** The card's activity value uses the **B-085/B-101 activity
  palette** (sedentary `--nok` → lightly `--accent` → gradient to extremely `--ok`) shared with
  `ActivitySelect` + the Poids period pill. No new token (color-mix on existing tokens).
- **Bottom sheets sit above the bottom nav (app-wide).** The S2 `Modal` `sheet` variant now
  anchors **above** the bottom tab bar (scrim bottom offset `calc(56px + env(safe-area-inset-bottom))`),
  so the **primary nav stays visible and tappable** while any sheet is open — the Journal day
  editor, Trier/⋯ sheets, **and** the S3 account menu sheet. This edits the **S2-owned**
  `Modal.module.css` (`.scrimSheet` + `.sheet`) outside its slice — an **owner-directed**
  cross-slice refinement (documented in `design/components/modals.md`); `Modal.tsx` unchanged.
- **"⋯" overflow kept = Export CSV (utility explained).** The owner questioned the near-empty
  "⋯" sheet. Its real, spec-mandated content is **Exporter CSV** (the desktop's visible Export
  button, relocated into "⋯" on mobile per spec §4.2 to declutter the toolbar) — a genuine
  screen-level action and the home for future ones — so the menu stays.

**Second refinement round (owner feedback, 2026-06-10).**

- **Month filter added (`FilterSheet`).** A dedicated **Filtrer** control sits in the toolbar
  **between Trier and "⋯"** (so Export stays in "⋯"): a new shared `components/ListChrome/FilterSheet`
  (generic **single-select** sheet; first option = "Tous les mois" reset) wired on Journal to the
  **months that have data this year** (a presentation-only client filter, like the sort — no
  backend). Picking a month shows only that month; the button reads **active** (`--accent`) when a
  month is applied; a stale selection (after a year change) clamps to "all". Multi-control filters
  (Recettes min-rating + archived) extend this family in S6.
- **Toolbar chrome controls are icon-only (app-wide convention).** Trier / Filtrer / "⋯" render as
  **icon-only** square `--tap` buttons (label via `aria-label`/`title`), established as the standing
  convention for **list-screen toolbar controls across the app** (documented in
  `design/components/data-tables.md`). It governs these compact chrome controls only — **action
  buttons** (Save, Export, Cancel, CTAs) keep their text. _(Owner: "applicable à l'ensemble des
  boutons de l'appli"; scoped to the toolbar chrome controls — the icon-only treatment that makes
  sense there, not a strip of every labelled action button.)_
- **Day count hidden on mobile.** The "{n} jours" count is dropped from the Journal mobile view
  (the sub-header is removed entirely); the desktop header count is unchanged.

## Mobile-responsive S6 — Recettes mobile cards + shared multi-control FiltersSheet — RESOLVED (user, 2026-06-10)

Sixth slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`, spec
§4.3 + §9). The Recettes screen (`/recipes`) rendered only the dense 10-column `RecipesTable`,
overflowing on a phone. S6 adds the **mobile card view**, the **last shared list-chrome member**
(the multi-control filter sheet), and wires the **FAB** to the full-screen builder — all behind a
`useIsMobile()` render-switch so desktop renders the **exact existing** table tree.

- **Render-switch + desktop extraction** (`features/recipes/RecipesPage.tsx`). The page gains
  `useIsMobile()` and branches to `RecipesMobile` (≤560px) or `RecipesDesktop` (≥561px). The
  desktop toolbar + loading/empty/table/footer were extracted **verbatim** into the new
  `RecipesDesktop` component (a pure refactor — identical rendered DOM) so the page stays a thin
  switch under the 80-line lint budget; the two branches share a spread `common` props object
  (desktop adds the per-row archive/restore). `RecipesToolbar`/`RecipesTable`/`RecipeRow` are
  **not edited**.
- **Recettes mobile** (`features/recipes/components/` new `RecipesMobile`, `RecipeCards`,
  `RecipeCard`, `recipes-mobile.module.css`): a **card per recipe** (name + rating stars; kcal/100g
  - L·G·P macros; a Lot / Portions / g·portion meta row), reusing the existing `Stars` component
    and `kcalDisplay`/`gramsDisplay`, fed the **same server-sorted/filtered `RecipeSummary[]`** and
    the **same `InfiniteScrollFooter`** as desktop (filtering/sorting stay server-side; the mobile
    view never re-filters). Archived recipes read **dimmed** + an "Archivée" tag. Sticky chrome via
    the shared `ListToolbar` (search field in the `leading` slot) + `SortSheet` (name / Lot /
    Portions / Note — the four server-sortable keys) + the new `FiltersSheet`.
- **New shared `FiltersSheet`** (`components/ListChrome/FiltersSheet.tsx` + `filters-sheet.module.css`,
  exported from the chrome barrel). The **multi-control** member of the list-chrome filter family
  (the single-select `FilterSheet` from S5 stays for Journal's month filter): one `Modal mobile="sheet"`
  stacking several declarative `sections` — a single-select **chip group** (reusing `Chip`) and/or a
  boolean **toggle**. First consumer = Recettes (min-rating chips + show-archived toggle — the desktop
  `FiltersPopover` controls in one sheet); funnel button reads **active** when any section is off
  default; sheet stays open across selections. **Created here, consumed read-only by Aliments (S7).**
  Reuses the chrome `toolBtn` styling + the S2 Modal `sheet` variant; **no new token**;
  `list-chrome.module.css` (owned by S5) untouched.
- **FAB + full-screen builder.** `Fab` (created unwired in S3) is wired in `RecipesMobile` → opens
  the add builder; tapping a card opens the edit builder. `RecipeBuilderModal` gained an optional
  `mobile` prop forwarded to `Modal` (passed `"fullscreen"` from the page) so the builder is a
  full-screen takeover ≤560px and **inert on desktop** (Modal applies the variant only when its own
  `useIsMobile()` is true → desktop stays `size="wide"`).
- **Archive/restore via the builder footer (owner decision, 2026-06-10).** Unlike the desktop row's
  inline 🗑/↺ icon, the mobile card is a single tap target with **no per-card archive control**;
  archive/restore is reached inside the builder's existing footer. _(Owner chose the cleaner card +
  one extra tap over a per-card icon; matches the mockup, which shows no card archive affordance.)_

**Desktop impact: none** — the render-switch returns `false` ≥561px → the `RecipesDesktop` tree
(identical to the former inline desktop JSX) renders unchanged; the mobile components never mount;
the builder's `mobile` prop is inert on desktop.

Contract delta: new `features/recipes/components/` `RecipesMobile.tsx`, `RecipesDesktop.tsx`,
`RecipeCards.tsx`, `RecipeCard.tsx` + `features/recipes/recipes-mobile.module.css`; new shared
`components/ListChrome/FiltersSheet.tsx` + `filters-sheet.module.css` (+ barrel export); render-switch

- `mobile="fullscreen"` wiring in `RecipesPage.tsx`; `mobile` prop on `RecipeBuilderModal.tsx`; i18n
  `recipes.archivedTag` (en/fr); a `FiltersSheet` bullet added to `design/components/data-tables.md`
  (_flagged_: the dev-plan said "no new amendment" — this is a faithful accuracy update turning the
  doc's forward-reference into a description of the realized component, not a new design decision).
  No `tokens.css`/backend/schema change; no new tests (responsive CSS verified by inspection;
  `FiltersSheet` is presentational — no new logic).

**Refinements (owner feedback, 2026-06-10).**

- **Card meta — whole grams + centred values.** The card's Lot / g·portion figures round to
  **integers** (new `features/recipes/format.ts` `gramsInt` — the 1-decimal precision is noise on
  large weights), and each value is **centred under its label** (`.kv` → `align-items:center;
text-align:center; flex:1`, the three columns spread across the card). Macros (per-100 g L·G·P)
  keep `gramsDisplay`. Mobile-card only; the desktop table is unchanged.
- **Search placeholder shortened to "Rechercher" / "Search" (Aliments + Recettes, desktop +
  mobile — owner decision).** The `foods.searchPlaceholder` and `recipes.searchPlaceholder` i18n
  strings drop the "(insensible aux accents)…" / "(accent-insensitive)…" parenthetical in both
  locales. **This is an explicit owner-approved change that affects desktop too** (not a mobile
  slice mechanism) — the owner asked for it on both screens at both widths.
- **Builder footer kept on one tightened row on mobile.** At the desktop paddings the recipe
  builder's three buttons (Archiver/Restaurer + Annuler + Enregistrer) overflow a 360px
  full-screen modal and clip "Enregistrer". ≤560px the `Modal` `.actions` footer + its buttons get
  **tighter padding and gaps** (`.actions` padding `14px 8px 16px`, `gap: --sp-3`; `.actions
button` padding `9px 8px`, `white-space: nowrap`) so all three fit **one line** while keeping the
  left/right grouping — Space Mono is monospace, so the worst case ("Restaurer"/"Annuler"/
  "Enregistrer") leaves ~18px spare at 360px. _(First attempt used `flex-wrap: wrap`; the owner
  rejected the resulting two-line footer — wants the three on one line, untruncated.)_ This edits
  the **S2-owned** `Modal.module.css` outside its slice — an **owner-directed** cross-slice
  refinement (precedent: the S5 sheets-above-nav change), documented in
  `design/components/modals.md`; mobile-only, desktop footers unchanged.

---

## Mobile-responsive S7 — Aliments mobile cards (Recettes pattern reuse) — RESOLVED (user, 2026-06-10)

Seventh slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`, spec
§4.3). The Aliments screen (`/foods`) rendered only the dense `FoodTable` (one ≤820px column-hide),
cramped on a phone. S7 gives Aliments the **same mobile treatment Recettes got in S6** (owner
decision: Aliments follows the Recettes pattern, not separately mocked) — a `useIsMobile()`
render-switch to a card list with the shared list chrome and a FAB to the full-screen food sheet.
**Pure pattern consumption: no `[shared]` file edited, no new contract surface.**

- **Render-switch + desktop extraction** (`features/foods/FoodsPage.tsx`). The page gains
  `useIsMobile()` and branches to `FoodsMobile` (≤560px) or `FoodsDesktop` (≥561px). The desktop
  toolbar + error banner + loading/empty/table/footer were extracted **verbatim** into the new
  `FoodsDesktop` component (a pure refactor — identical rendered DOM) so the page stays a thin
  switch; the two branches share a spread `common` props object (desktop adds the per-row
  archive/restore). `FoodsToolbar`/`FoodTable`/`FoodRow`/`FiltersPopover`/`foods.module.css` are
  **not edited**.
- **Aliments mobile** (`features/foods/components/` new `FoodsMobile`, `FoodCards`, `FoodCard`,
  `foods-mobile.module.css`): a **card per food** with **spec-strict content** (owner decision,
  this session) — name + rating stars (+ an "Archivé" tag when archived); kcal/100g · L·G·P macros;
  a single **Portion** line (`portionSummary`). **No** visibility tag, **no** comment on the card
  (both are mobile-omitted; visibility is still filterable). Reuses the existing `Stars`,
  `kcalDisplay`/`gramsDisplay`/`portionSummary`, fed the **same server-sorted/filtered `Food[]`**
  and the **same `InfiniteScrollFooter`** as desktop (filtering/sorting stay server-side). Archived
  foods read **dimmed**. Sticky chrome via the shared `ListToolbar` (search in `leading`) +
  `SortSheet` (the 7 server-sortable keys: name/kcal/F/C/P/note/visibilité) + `FiltersSheet`.
- **`FiltersSheet` consumed read-only** (created in S6). Aliments has **one more filter than
  Recettes** — visibility — handled by a second `kind:'chips'` section (`FiltersSheet` already
  supports N sections): min-rating chips + visibility chips + show-archived toggle; funnel reads
  **active** when `minRating>0 || visibility!=='all' || showArchived`. The shared chrome
  (`ListToolbar`/`SortSheet`/`FiltersSheet`/`list-chrome.module.css`/`filters-sheet.module.css`) is
  **not edited**.
- **FAB + full-screen food sheet.** `Fab` (created unwired in S3) is wired in `FoodsMobile` → opens
  the add sheet; tapping a card opens the edit sheet. `FoodModal` gained an optional `mobile` prop
  forwarded to `Modal` (passed `"fullscreen"` from the page) so the sheet is a full-screen takeover
  ≤560px and **inert on desktop** (Modal applies the variant only when its own `useIsMobile()` is
  true). Archive/restore stay reached in the food sheet's existing footer (mirrors the S6 builder —
  no per-card archive control).

**Desktop impact: none** — the render-switch returns `false` ≥561px → the `FoodsDesktop` tree
(identical to the former inline desktop JSX) renders unchanged; the mobile components never mount;
the `FoodModal` `mobile` prop is inert on desktop.

Contract delta: new `features/foods/components/` `FoodsMobile.tsx`, `FoodsDesktop.tsx`,
`FoodCards.tsx`, `FoodCard.tsx` + `features/foods/foods-mobile.module.css`; render-switch +
`mobile="fullscreen"` wiring in `FoodsPage.tsx`; `mobile` prop on `FoodModal.tsx`; i18n
`foods.archivedTag` (en/fr). **No design-system amendment** (the row→card variant + shared chrome
were already promoted to `design/components/data-tables.md` in S5/S6; Aliments is a documented
consumer). No `tokens.css`/backend/schema change; no new tests (responsive CSS verified by
inspection; the card/mobile components are presentational — no new logic).

## Mobile-responsive S8 — Poids mobile (controls row + list → detail sheet → full-screen weigh-in) — RESOLVED (user, 2026-06-10)

Eighth slice of the mobile-responsive feature (`specifications/features/mobile-responsive/`, spec
§6 + §4.3). The Poids screen (`/weight`) rendered the 15-column `PeriodTable` (horizontal-scroll
box) — unreadable on a phone. S8 gives Poids a **list + detail** mobile presentation: a
`useIsMobile()` render-switch to a compact period list whose rows open a detail sheet, plus a
sticky controls row and a FAB. **No `[shared]` foundation file edited** (ListChrome / `Fab` /
`Modal` variants consumed read-only).

- **Render-switch + desktop extraction + shared overview** (`features/weight/WeightPage.tsx`). The
  page gains `useIsMobile()` and branches to `WeightMobile` (≤560px) or `WeightDesktop` (≥561px),
  with the `WeighInModal` rendered **once** below the switch (shared). The current desktop tree
  (`WeightHeader` + cartouche + chart + `PeriodTable`) was extracted **verbatim** into
  `WeightDesktop` (pure refactor — identical DOM), and the cartouche + chart/empty-range block was
  factored into a shared `WeightOverview` consumed by **both** branches (no duplication, byte-
  identical render). `PeriodTable`/`PeriodRow`/`Cartouche`/`components/Chart/*` are **not edited**.
- **Mobile controls row** (`WeightMobile`): the shared `ListToolbar` with the **Régime/Maintien**
  `FlagToggle` in `leading` + an `OverflowMenu` ("⋯") holding **Export CSV**. The page's desktop
  `<h1>Poids</h1>` (in `WeightHeader`) is **not** rendered on mobile — the app bar already shows the
  "Poids" title (S3) — mirroring Journal/Aliments.
- **Chart range + waist stay on the chart** (owner decision, 2026-06-10). Spec §6 was internally
  ambiguous (controls row "+ chart range" vs chart "compact range control"); the owner chose to keep
  the range selector and the waist toggle in the chart header (already responsive) rather than lift
  them into the toolbar — which avoids editing the **shared** `components/Chart/*`. The cartouche
  stacks **full-width** ≤560px (new `@media (max-width:560px)` rule on `.cartouche` →
  `grid-template-columns: 1fr`).
- **Period list + detail sheet** (`features/weight/components/` new `PeriodList`, `PeriodListRow`,
  `PeriodDetailSheet` + `weight-mobile.module.css`). `PeriodList` (fed the same `Period[]` as the
  table) renders a **compact row** per period: période + durée · Poids · Δ · Déficit/j + chevron,
  the Δ/déficit tinted via the existing `period-style` trend tones (reused, never recomputed —
  CLAUDE.md rule 2). Tapping a row opens `PeriodDetailSheet` (`Modal mobile="sheet"`) showing **all
  15 figures** grouped **Poids / Énergie / Contexte** (none dropped), reusing `format.ts` +
  `period-style.ts` and the existing `weight.col.*`/`weight.flag.*` labels.
- **"Modifier la pesée" + FAB → full-screen weigh-in.** The detail sheet carries a **"Modifier la
  pesée"** action that resolves the period's ending weigh-in (the same `byDate` map the desktop
  row-click uses) and opens `WeighInModal`; the `Fab` (created unwired in S3) opens the add form.
  `WeighInModal` gained an optional `mobile` prop forwarded to `Modal` (passed `"fullscreen"` from
  the page) so the form is a full-screen takeover ≤560px and **inert on desktop**; the one-per-day
  `ConflictConfirm` stays a centered dialog. Create/edit/delete round-trip through the same
  mutations as desktop.

- **Cartouche refinement (owner, 2026-06-10).** The five stat tiles took too much vertical space on
  a phone. ≤560px the cartouche now **drops the projection tile** (the last child,
  `.cartouche > *:last-child { display:none }`), lays the remaining **four out 2×2** with
  **equal heights** (`grid-auto-rows: 1fr`), a tighter inter-tile gap, and **shrunk tile padding**.
  The padding is tightened via a new `--metric-stat-pad` hook on `MetricCard.module.css`'s `.card.stat`
  (`var(--metric-stat-pad, var(--sp-6) var(--sp-7))` — **identical default**, so Stats/Cibles are
  unchanged); the Poids cartouche sets `--metric-stat-pad: var(--sp-3) var(--sp-5)` ≤560px only.
  _Flagged:_ this touches the **shared** `MetricCard.module.css` (outside S8's declared files) — an
  owner-directed, zero-default-change hook (precedent: the S5 round-2 owner-directed Modal edit). The
  projection figure stays available on desktop (5-tile grid) and in the data; only the mobile tile is
  hidden.

**Desktop impact: none** — the render-switch returns `false` ≥561px → `WeightDesktop` (identical to
the former inline desktop tree, sharing `WeightOverview`) renders unchanged; the mobile
list/sheet/FAB never mount; the `WeighInModal` `mobile` prop is inert on desktop; the desktop-
reachable CSS changes are the cartouche rules, all gated `@media (max-width:560px)`, and the
`MetricCard` `--metric-stat-pad` hook keeps its current default so every existing tile is byte-identical.

Contract delta: new `features/weight/components/` `WeightDesktop.tsx`, `WeightOverview.tsx`,
`WeightMobile.tsx`, `PeriodList.tsx`, `PeriodListRow.tsx`, `PeriodDetailSheet.tsx` +
`features/weight/weight-mobile.module.css`; render-switch in `WeightPage.tsx`; the cartouche
`@media (max-width:560px)` rules in `weight.module.css` (2×2, drop projection, equal heights,
tighter padding); the `--metric-stat-pad` hook on the shared `MetricCard.module.css` (zero-default-
change); `mobile` prop on `WeighInModal.tsx`; i18n `weight.detail.*` (en/fr). **Design-system
amendment:** a small faithful-accuracy addition to
`design/components/data-tables.md` documenting the **list + detail** variant (the dev plan listed
"None new"; the prior doc only described the Journal "tap → editor" path, so this records the Poids
read-only detail sheet + "Modifier" → full-screen — flagged, accuracy only). No
`tokens.css`/backend/schema change; no new tests (responsive CSS verified by inspection; the mobile
components are presentational — figure formatting + weigh-in resolution already exist and are tested).

## Mobile-responsive follow-ups — account-sheet theme toggle + Contenants mobile — RESOLVED (user, 2026-06-10)

Two owner-directed mobile refinements outside the S1–S10 slice plan (the mobile-responsive feature
remains; these are small per-screen follow-ups in the spirit of dev-plan §11 "secondary screens get
minor refinements as needed"). Both desktop-inert.

- **Account sheet — theme toggle moved into the top bar.** The mobile account bottom sheet
  (`AccountMenu` → `Modal mobile="sheet"`) previously held the theme toggle as the first body row.
  Owner request: put it on the **top row, between the username and the close `×`**. `Modal` gained an
  optional **`headerAction`** slot (an additive, shared S2-component change — owner-directed, flagged)
  rendered in the mobile top bar between the (now flex-`1`, truncating) title and the close button;
  `AccountSheet` passes `<ThemeToggle/>` there and the old `.sheetThemeRow` body row + CSS are
  removed. Omitting `headerAction` (every other modal) leaves the bar exactly title + `×` — desktop
  and all other consumers unchanged. Documented in `design/components/modals.md`.
- **Contenants → mobile cards (same Aliments/Recettes pattern).** The `/containers` screen was
  desktop-only (a secondary route inheriting just the shell). Owner request: base it on
  Aliments/Recettes — search frame + FAB. A `useIsMobile()` render-switch in `ContainersPage` (now a
  thin switch; the desktop tree — toolbar + lead + `ContainerTable` — extracted **verbatim** to
  `ContainersDesktop`) mounts `ContainersMobile` ≤560px: the shared `ListToolbar` (search in
  `leading`) + `SortSheet` (name / empty-weight, the existing client sort) over `ContainerCards`/
  `ContainerCard` (name + empty weight; the built-in "Rien" is a non-tappable badged + locked card),
  plus a **FAB** opening the add sheet. Tapping an editable card opens `ContainerModal`, which gained
  a `mobile` prop forwarded to `Modal`; delete stays in the sheet footer. (The desktop lead hint is
  omitted on mobile and the container/delete modals are bottom sheets — both refined later this
  session, see the next entry.) The desktop
  `ContainerTable`/`ContainersToolbar`/`containers.module.css` are **not edited**; new
  `ContainersDesktop`/`ContainersMobile`/`ContainerCards`/`ContainerCard` + `containers-mobile.module.css`.
  No new i18n (reuses `containers.*`); no `tokens.css`/backend change; no new tests (presentational).

**Desktop impact: none** — both render-switches return `false` ≥561px (desktop trees byte-identical),
the mobile components never mount, and the `Modal` `headerAction`/`mobile` props are inert without a
mobile variant. typecheck + lint + 392 tests + web build green.

## Mobile-responsive follow-ups (2) — account-menu pages: hide redundant title + popups as bottom sheets — RESOLVED (user, 2026-06-11)

Three more owner-directed mobile refinements across the **account-menu pages** (`/account`, `/cibles`,
`/containers`, `/assistant-ia`, `/parametres`, `/about`). All desktop-inert (CSS gated `@media
(max-width:560px)` or the `Modal mobile="sheet"` variant, which is inert ≥561px).

- **Hide the page title on mobile (redundant with the app bar).** The S3 app bar already shows the
  route-derived screen title ≤560px, so each page's own heading duplicated it. Added a
  `@media (max-width:560px) { display:none }` rule to the title class of each page module:
  `account.module.css`/`settings.module.css`/`about.module.css` `.h1` (settings covers both Paramètres
  and Assistant IA), and `cibles.module.css` `.head` (hidden whole — it holds only the title).
  Contenants already had no mobile title (the mobile branch drops the toolbar). Desktop headings
  unchanged.
- **All account-page popups → bottom sheets.** Owner request: every popup on these pages should open
  as a bottom sheet above the primary nav (the S2 `sheet` variant), not centered. Added `mobile="sheet"`
  to: `PasswordModal` (change password), `SuggestDialog` / `RecomputeConfirm` / `DeleteTargetConfirm`
  (Cibles), `ContainerModal` (add/edit — **changed from `fullscreen` → `sheet`**) + `DeleteConfirm`
  (Contenants), `ConfirmTyped` (Paramètres wipe "tout effacer" + import — shared component used only by
  Paramètres) + `MealTemplateDeleteConfirm`. Each keeps `size="confirm"` so desktop stays the centered
  dialog. **Taxonomy note (flagged):** this intentionally makes account-page _confirmations_ bottom
  sheets, an owner-directed exception to the §0.2 "confirmations = centered dialog" rule, which still
  holds for the primary screens (delete meal, clear day, archive — untouched). Noted in
  `design/components/modals.md`.
- **Contenants mobile: drop the lead hint.** The "Le poids à vide sert…" lead paragraph is omitted on
  mobile (owner request) — removed from `ContainersMobile` (desktop keeps it).

**Desktop impact: none** — the title rules are mobile-only media queries; the `mobile="sheet"` props are
inert ≥561px (centered `size="confirm"` dialogs unchanged); the lead is still shown on desktop. No
`tokens.css`/backend/schema change; no new i18n; no new tests (presentational). typecheck + lint + 392
tests + web build green.

## Mobile-responsive follow-up (3) — FAB clearance in the Trier/Filtres sheets — RESOLVED (user, 2026-06-11)

On the screens that render the floating "+" FAB (Aliments, Recettes, Contenants), the FAB
(`position:fixed`, 52px, sitting `var(--sp-5)` above the bottom nav) floated over the bottom-right of
an open **Trier**/**Filtres** bottom sheet, covering the last option. Owner request: add bottom space
to those sheets so nothing is hidden. Added an opt-in **`fabSafe`** prop to the shared `SortSheet` and
`FiltersSheet` (ListChrome): when set, the sheet body gets a `.fabSafe` class with
`padding-bottom: calc(52px + var(--sp-5) + var(--sp-6) + env(safe-area-inset-bottom))` (clears the
FAB's ~62px reach). Passed by `FoodsMobile`/`RecipesMobile` (both sheets) and `ContainersMobile`
(SortSheet). **Scoped, not global:** FAB-less screens (Journal's Trier/Filtrer/⋯) omit the prop and
keep the tighter padding; the single-select `FilterSheet` and `OverflowMenu` (Journal-only / single-
item) are untouched. Shared ListChrome edit (S5/S6-owned), owner-directed — flagged. No new i18n;
no new tests (presentational). typecheck + lint + 392 tests + web build green.

## Meals — colour-code L/G/P macro values (desktop + mobile) — RESOLVED (user, 2026-06-11)

**Owner-approved desktop change** (raised alongside the mobile-responsive S9 slice; committed
**separately** from S9 per the "desktop never changes silently" rule). The per-line **L/G/P** macro
values **and** the meal-footer **L/G/P** totals are now tinted with the macro tokens
(`--c-fat`/`--c-carb`/`--c-prot`) — the same tokens as the totals dots and the S4 mobile food line —
**at every width**, on the Repas screen. `kcal` keeps its colour; quantity-0 lines stay muted (the
tint is gated on `:not(.zero)`). Implementation: the per-line colour rules moved from the
`@media (max-width:560px)` block into base scope in `food-line.module.css`; the three footer total
spans gained `fat`/`carb`/`prot` classes (`MealFooter.tsx`) tinted in `meal-column.module.css`. Noted
in `design/components/data-tables.md` (Repas meal column). No `tokens.css`/backend/schema change; no
new i18n; no new tests (presentational).

## Mobile-responsive S9 — Repas interactions (picker · line sheet · day/meal menus · swipe · touch reorder) — RESOLVED (user, 2026-06-11)

Slice S9 of the mobile-responsive feature (`specifications/features/mobile-responsive/`) completes
spec §5: the Repas screen becomes fully usable by finger on phones (≤560px), desktop-inert by
mechanism (mobile-only CSS + `useIsMobile()` render gates; ≥561px renders the existing tree). Pieces:
**full-screen food picker** (replaces the inline autocomplete; **search-only** — owner decision: the
app has no recently-logged source, so no "recents", which would be backend work and a separate future
task); **bottom-sheet line editor** (change food · quantity+unit · pin · delete — the pin/× leave the
mobile line); **mobile tap routing** on the two-row line (name → picker, qty → inline edit, body →
line sheet); **"⋯" day menu** bottom sheet (+ Repas · Copier hier · Vider · undo/redo · **✨
Proposition IA** — owner decision, since the desktop controls row is hidden ≤560px); **meal-switch
swipe**; **long-press touch drag-to-reorder** (owner chose the spec gesture over up/down buttons).

**Two owner-directed deviations from spec §5.3 (flagged):** (1) **cook mode 🍳 is removed on mobile**
(the trigger is hidden ≤560px, so the cook takeover never opens on phones; desktop keeps it); (2) the
**meal "⋯" menu becomes a bottom sheet on mobile** and gains **"Gérer les restes"**, and the meal-card
footer **⊟ Restes button is hidden on mobile** (the leftover popup is reached from the meal menu). The
desktop dropdown + footer Restes button are unchanged. New shared web components: none (the S2 `Modal`
mobile variants and `useIsMobile()` are consumed read-only). New logic tests: `swipeIntent`,
`computeOrder` (gesture wiring + layout verified by inspection, not unit tests). Documented in
`design/components/data-tables.md` (Repas meal column → Mobile subsection); spec §5 marked applied.
typecheck + lint + 233 web tests green.

## Mobile-responsive S9 follow-ups — Repas sheets, portal, activity, scaffold tap — RESOLVED (user, 2026-06-11)

Owner refinements to the S9 Repas mobile work:

- **All Repas overlays are bottom sheets** (not full-screen / centered): the food picker, the
  manual/custom entry (`CustomFoodModal`), and the AI dish analysis (`AiDishAnalysisDialog`) gained
  `mobile="sheet"` (the picker was `fullscreen`). They anchor just above the bottom nav like every
  other screen's sheets.
- **Sheets render over the meal-tabs band.** The `Modal` now **portals its scrim to `document.body`**
  (`createPortal`), so it escapes the sticky day bar's stacking context (`--z-sticky-sub`) that was
  trapping the day "⋯" sheet _under_ the meal-tabs bar (clipping its bottom). Shared-Modal change,
  owner-directed; noted in `design/components/modals.md`. No visual change to other screens' modals.
- **Day "⋯" menu: "Proposition IA" is the first item.**
- **Activity selector (mobile):** the dropdown is right-aligned to the screen edge with the "?" just
  to its left (`.actWrap` → `justify-content:flex-end; width:100%`, dropped the `.actHead` order swap).
- **Bug fix:** tapping a **garde-manger scaffold pre-fill line** (pinned, qty 0, empty id) now opens
  the line editor — `LineSheetTarget` carries the row, and the sheet resolves the entry by
  `order_index` when there is no id (offering change-food + quantity; pin/delete appear once the line
  is materialised).
- **Leftovers correction (supersedes the S9 deviation #2 above).** The earlier S9 decision moved
  "Gérer les restes" into the meal "⋯" sheet and hid the footer ⊟ Restes button on mobile — that was
  wrong. The **⊟ Restes button stays in the meal footer** on mobile, and the **`LeftoverModal` opens
  as a bottom sheet** (`mobile="sheet"`). The meal "⋯" sheet no longer carries a leftovers item; the
  now-unused `meals.meal.manageLeftover` i18n key was removed.

Mobile-only / desktop-inert by mechanism. typecheck + lint + 233 web tests green.

## CZ-1 / B-141 — Stats avg-kcal chart: target zone follows the target history — RESOLVED (author, 2026-06-11)

**Problem.** The monthly avg-kcal chart shaded a **single flat band** spanning the whole
year, taken from the target **in effect today** (`services/stats.ts → currentZone`,
`MonthCalorieBars.tsx`). When the target changed during the year the band was wrong for
every month a different target applied — the same defect the per-period weight trajectory
already fixed (WT-1/B-099).

**Decision.** The band is now resolved **per month** from the Target in effect on the
month's **end date** (last calendar day): the latest `effective_from ≤ end_date`, falling
back to the **earliest** Target for months before any Target exists (retroactive — mirrors
`currentAsOf` / B-090 and the per-period rate / B-099). The band therefore **steps** at each
target boundary. Resolution reads the **live target history** (`targetRepo.list`), like the
weight trajectory — not the per-day frozen snapshots (B-100 governs the rolling window, a
different surface). The response's top-level `target_zone` (band in effect today) is
**unchanged** and still drives the rolling cards / signals.

**Rationale.** Mirrors WT-1/B-099 exactly (the item's own reference). Reading the end date
matches how a month is "closed"; the earliest-target fallback keeps parity with `currentAsOf`
so pre-target months are not left unshaded when an early target exists.

**Spec impact:** `spec/logic/stats-adherence.md §5` (per-month band + worked example),
`spec/api/weight-targets-stats-settings.md §Stats` (`monthly[].target_zone`),
`design/components/charts.md` (per-month stepped band), `specifications/screens/stats.md §C`.
**Code:** shared `dto/stats.ts` (`MonthlyStat.target_zone`); api new pure
`domain/stats/monthly-zones.ts` (`zoneAsOf` + `monthEndDate`) + `monthly.ts`
(`monthlyPivot(logged, targets, year)`) + `services/stats.ts` (`targetBands`); web
`features/stats/components/MonthCalorieBars.tsx` (per-month rects, `zone` prop dropped) +
`AdherenceSections.tsx`. New oracle in `domain/stats/stats.test.ts` (2-target stepping +
retroactive fallback + `monthEndDate` edges). No DB/schema change.

## EC-1 / B-138, B-139 — numeric écart vs target on Journal + Repas cards — RESOLVED (author, 2026-06-11)

**Problem.** Both adherence surfaces showed only a word/badge (Journal: OK/NOK badge; Repas
cards: OK / En-dessous / Dessus) — never **by how much** the day is off target. The user wants
the signed kcal/macro écart, colour-coded, on each surface.

**Decision (behaviour).** _(Reflects the author correction recorded below.)_

- **B-138 (Journal verdict column).** Show the signed **kcal écart vs the upper target**
  (`kcal − cal_max`), **always relative to `cal_max`** and **always shown** on a logged day
  (green/yellow) — including an in-band **OK** day, where it is a negative headroom. At/under
  `cal_max` → **green**; over → **red**. Red/empty days show nothing. **Desktop:** placed **just to
  the right** of the OK/NOK badge — the badge sits in a fixed-width slot so the écart has only a
  light margin yet the figures line up down the column (not pushed to the far edge). **Mobile:** to
  the **left** of the OK/NOK badge (no alignment).
- **B-139 (Repas 4 cards).** **Calories:** OK → nothing; below → red `value − cal_min`; above → red
  `value − cal_max`; **to the right** of the status word, **always red**. **Lipides/Protéines**
  (floor) & **Glucides** (ceiling): always show `value − threshold`, **green when on target (`ok`)
  else red** (floor: below red / at-or-above green; ceiling: below green / above red) — placed **to
  the right** of the status word on **desktop** and **below** it (right-aligned) on **mobile** (≤560px).
- **Intentional asymmetry (recorded, not a conflict):** Journal at/under-target is **green**
  (retrospective bilan), Repas under-kcal is **red** (building the day) — both explicit user choices.

**Correction (author, 2026-06-11, same day).** The first pass (commit `5e3d4a7`) computed the
Journal écart vs the **nearest band edge** (`cal_min` below / `cal_max` above) and hid it inside the
band, and stacked the Repas macro écart **below** the status word on desktop. Per author feedback:
(1) the Journal écart is **always `kcal − cal_max`** and **always shown** on logged days (an OK day
must still display its headroom); (2) on desktop it sits **just right of the badge** (fixed-width
badge slot + light margin, aligned) — not at the far column edge; (3) the Repas macro écart is **to
the right** of the status word on **desktop** (below only on mobile). `kcalBandGap` → `kcalUpperGap`.

**Decision (where the figure is computed) — the server/client split.** Each surface follows the
pattern already established in its own code, which is also the rule-2-faithful choice there:

- **B-138 → server-computed.** `JournalRow` does not expose the band and the journal verdict is
  already fully server-computed, so the écart is computed server-side as **one additive field**
  `kcal_gap: number | null` on `JournalRow` (null = in band, or a non-logged day). The web only
  renders it → strict CLAUDE.md rule 2. New pure `domain/day-verdict/verdict.ts kcalUpperGap`.
- **B-139 → client-side display derivation.** The Repas cards already receive `value` + thresholds
  and already derive the status word + bar colours locally (documented "display-only, never
  authoritative"). The écart `value − threshold` is the same nature of display derivation, so it is
  computed in the card from props it already holds — **no DTO/API change**. (The pre-existing
  client-computed status word is left as-is; moving it server-side is out of scope.)

**Spec impact:** B-138 — `spec/api/days-meals-leftover.md §Journal` (`kcal_gap`),
`shared/dto/day.ts` (`JournalRow.kcal_gap`), `specifications/screens/history.md`,
`design/components/data-tables.md`. B-139 — `design/components/metric-cards.md`,
`specifications/screens/meals.md` (no DTO/API change). **Code:** api `kcalUpperGap` +
`services/journal.ts` (`toRow`/`emptyRow`); web shared `lib/format/number.ts signedInt`,
`JournalRow.tsx`/`JournalCard.tsx` (badge slot + module CSS), `CalorieCard.tsx`/`MacroCard.tsx` +
`BandCard.module.css` (macro écart row→column at ≤560px). Tests: `kcalUpperGap` oracle + journal
integration `kcal_gap`; RTL écart tests for `JournalRow`, `CalorieCard`, `MacroCard`. No DB/schema change.

## MF-1 / B-162 — hide the "Total" label on mobile meal footers — RESOLVED (author, 2026-06-12)

**Problem.** The Repas meal-column footer shows a "Total" label (`meals.total`) next to the ⊟ Restes
button. On a phone it is redundant clutter — the weight/kcal/macro totals are self-evident under
their columns.

**Decision.** Hide the "Total" label on **mobile only** (≤560px); keep the ⊟ Restes button and all
numeric totals; desktop unchanged. CSS-only: `.tlabel { display: none }` added to the existing
`@media (max-width: 560px)` block in
`features/meals/components/MealColumn/meal-column.module.css`. The `meals.total` i18n key stays (used
on desktop); no markup/DTO/API/i18n change.

**Spec impact:** `specifications/screens/meals.md` (responsive rules — "Total" label hidden ≤560px).
**Tests:** none — cosmetic, mobile-only, no markup change (jsdom has no media-query/layout engine);
full suite stays green; owner-verified visually.

## EW-1 / B-165 — uniform OK/NOK + activity selector widths (desktop) — RESOLVED (author, 2026-06-12)

**Problem.** The OK/NOK verdict selector and the activity-level selector are both content-driven
widths, so they vary row-to-row in the Journal and don't line up between Journal and Repas. The user
wants each selector type to share **one fixed width** so the columns line up — on desktop. The Repas
**mobile** reduced OK/NOK badge ("A" not "Auto", smaller padding/font) must stay as-is.

**Decision (behaviour).** On **desktop** (`min-width:561px`) the OK/NOK badge gets a **uniform fixed
width** (`99.12px` — the measured natural "NOK · Auto · ▾" border-box width, matching the pre-B-165
footprint exactly per owner feedback; px not rem because the type scale is px-fixed; a forced verdict's
"forcé" sub-label is one char wider and may sit a hair tight) and the activity selector
gets a **uniform fixed width** (`7rem`, sized to "Très intense · ▾", caret pushed to the right edge).
Each type is uniform within itself (verdict and activity are sized to their own content, not forced
equal to each other). Applies to **Journal + Repas** (both render the shared `VerdictBadge` /
`ActivitySelect`). On **mobile** (≤560px) neither width applies, so the existing Repas reduced-badge
rule (`meals.module.css`) and the mobile layouts are **untouched**.

**Decision (mechanism) — web-only CSS, desktop-gated.** The fixed widths live on the **shared
controls**, gated to desktop so mobile needs no edit: `VerdictBadge.module.css .badge` and
`ActivitySelect.module.css .act` (the activity width is scoped to `.act`, only ever on the
ActivitySelect trigger, so other `SelectMenu` users — e.g. `RatingSelect` — are unaffected). The
Journal `.badgeSlot` min-width is set to `99.12px` to match the verdict width so the B-138 écart
still aligns (`.activitySlot` already equals the `7rem` activity width). No markup/DTO/API/i18n
change. Refines B-138 (`.badgeSlot`) and B-163 (`.activitySlot`), which deferred this to B-165.

**Spec impact:** `design/components/badges-verdict.md` §A (verdict uniform width),
`design/components/metric-cards.md` (activity uniform width, scoped to `.act`),
`design/components/data-tables.md` (replaces the "B-165's separate change" forward-ref),
`specifications/screens/history.md` + `meals.md` (uniform widths; Repas mobile reduced kept).
**Code:** `VerdictBadge.module.css`, `ActivitySelect.module.css`, `features/journal/journal.module.css`.
**Tests:** none — purely cosmetic widths (no markup change; jsdom has no layout engine); the full
suite stays green and the values are owner-verified visually (one-line tunable).

## JT-1 / B-164 — HTML hover tooltips on the two Journal écarts (desktop) — RESOLVED (author, 2026-06-12)

**Problem.** The two Journal écarts (target `kcal_gap` B-138, expenditure `burn_gap` B-163) render as
a bare coloured number — they don't say _what_ the figure measures. The user wants a pretty hover
tooltip on each, on desktop.

**Decision (behaviour).** On **desktop**, hovering either écart shows a **styled HTML tooltip** (not
the native `title`) with a plain-French sentence: target écart → "{{n}} calories en dessous de la
cible" / "… au-dessus de la cible"; expenditure écart → "{{n}} calories en dessous de la dépense
estimée" / "… au-dessus de la dépense estimée" ({{n}} = absolute value via `formatInt(Math.abs)`;
"en dessous" when the écart is ≤ 0 / green, "au-dessus" when > 0 / red). **No tooltip on mobile.**
This is **desktop-only by construction**: `JournalRow`/`JournalGap` only render in the desktop table
(`JournalPage` swaps to mobile `JournalCard`s ≤560px, and the cards render their écart as a plain
span, not via `JournalGap`).

**Decision (mechanism) — web-only, pure presentation (CLAUDE.md rule 2).** New small **shared hover
Tooltip primitive** (`components/Tooltip`): a CSS-only styled bubble (`role="tooltip"`) revealed on
`:hover`/`:focus-within` — no JS state, no native `title`. Plain absolute positioning (no portal):
the Journal table has **no** clipping scroll ancestor (`DataTable .wrap`, not `.tblscroll`), so the
bubble is not clipped. The B-163 `JournalGap` gains a `kind: 'target' | 'burn'` prop, builds the
sentence from the sign + `journal.gap.*` i18n keys, and wraps its existing coloured span in
`<Tooltip>`. The `.gap` span/classes are unchanged (alignment + existing tests intact).

**Spec impact:** `specifications/screens/history.md` (Écart tooltips, desktop only), new
`design/components/tooltip.md` (hover Tooltip primitive) + cross-ref in
`design/components/data-tables.md`, i18n `journal.gap.{targetUnder,targetOver,burnUnder,burnOver}`
(fr + en). **Code:** web new `components/Tooltip/Tooltip.tsx` + CSS; `JournalGap.tsx` (kind prop +
Tooltip wrap), `JournalRow.tsx` (pass kind). **Tests:** RTL on `JournalRow` asserting the four
tooltip sentences (`[role="tooltip"]` text) + existing null/colour assertions unchanged. **No**
DTO/API/DB change. **Depended on** JX-1/B-163 (the expenditure écart must exist).

## JX-1 / B-163 — second Journal écart: kcal vs estimated expenditure — RESOLVED (author, 2026-06-12)

**Problem.** The Journal row showed distance from the **target band** (`kcal_gap`, B-138) but not
distance from the day's **estimated expenditure** — the retrospective deficit/surplus. The user
wants a second, distinct écart `kcal − estimated_burn` beside the Activité selector (the same
"Dépense estimée" figure used on Repas).

**Decision (behaviour).** Add a **second** signed kcal écart on each Journal row:
`burn_gap = day_kcal − estimated_burn`, where `estimated_burn = BMR(weight on the day) ×
activity_multiplier(day's activity_level)` — i.e. **the day's existing per-day deficit**
(`metabolic-engine.md §5`, `day-snapshot-verdict.md §7`), **no new formula**. Negative (intake under
burn, a deficit) → **green**; positive (surplus) → **red** — same `signedInt` + `.gap`/`.gapUnder`/
`.gapOver` as B-138. **Visibility:** only on a logged (green/yellow) day **that has a weigh-in
on/before its date** (no weight → no expenditure → nothing); `null` otherwise. **Desktop:** just to
the **right of the Activité selector** (selector in a fixed-width slot, light margin, figures line up
down the column — mirrors the verdict-cell écart). **Mobile:** **right-aligned on the activity line**
of the card. It is the twin of the B-138 verdict-column écart; a row can now show both (vs band + vs
expenditure).

**Decision (where the figure is computed) — server-computed (CLAUDE.md rule 2).** Like B-138, the
écart is **one additive field** `burn_gap: number | null` on `JournalRow`; the web only renders it.
The Journal service did not previously load per-day weight/profile (the band is frozen on the
snapshot, but the burn needs body weight), so the service now **batch-loads once** the profile +
the full weigh-in series (`profileRepo.get` + `weightRepo.findAll`) and resolves the latest weight
as-of each day — no N+1. New small module `services/journal-burn.ts` (`loadBurnContext` +
`burnGapFor`) reusing the metabolic domain (`mifflinStJeor`, `estimatedBurn`, `deficitPerDay`,
`ageYears`) and `shared` `ACTIVITY_MULTIPLIERS`. No DB/schema change.

**Spec impact:** `spec/api/days-meals-leftover.md §Journal` (`burn_gap`), `shared/dto/day.ts`
(`JournalRow.burn_gap`), `spec/logic/metabolic-engine.md §5` + `day-snapshot-verdict.md §7` (Journal
exposes the per-day deficit), `specifications/screens/history.md` ("Écart vs dépense"),
`design/components/data-tables.md` (activity-cell écart). **Code:** api `services/journal-burn.ts` +
`services/journal.ts` (`toRow`/`emptyRow`); web `JournalRow.tsx`/`JournalCard.tsx` (activity slot +
module CSS). **Tests:** journal integration `burn_gap` (profile+weigh-in oracle: BMR 1730 ×1.2 = burn
2076 → 2400 → +324 / 1800 → −276; null on no-weigh-in + red days); RTL écart test on `JournalRow`.
**Out of scope (later batches):** JT-1/B-164 (delta tooltips), EW-1/B-165 (uniform selector widths).

## CT-1 / B-140 — multi-line styled chart tooltip + in-viewport flip/clamp — RESOLVED (author, 2026-06-11)

**Problem.** The styled HTML chart tooltip (`ChartTooltip`, B-056/SC-1) rendered a single
pre-joined line `"title · val1 · val2"` and had **no edge handling**, so near a chart border it
was clipped by the viewport. The user asked for a **multi-line** layout (bold title, one value per
line), the card to **always stay in the viewport**, and — as a follow-up this session — to "make it
a proper, pretty tooltip".

**Decision (behaviour).**

- **Layout.** The card shows a **bold title line** then **one value per line** (no `·` inside the
  card). Title/rows per chart: weight point → `date` / `78.5 kg` (waist → `date` / `85 cm`); OK-NOK
  bars → `month` / `15 OK` / `5 NOK`; avg-kcal bars → `month` / `OK 1800` / `NOK 1950` /
  `Moyenne globale 1875 kcal`.
- **In-viewport.** The card **flips/clamps** to stay fully visible: defaults above the anchor, flips
  **below** near the top edge, shifts **horizontally** near the left/right edges; never clipped, on
  desktop and mobile.
- **Polish (pretty tooltip).** A **caret** triangle points at the anchor (bottom edge by default,
  top edge when flipped below, kept aligned with the anchor after a horizontal clamp), a clear
  title/value **type hierarchy** (`--text` bold title, `--text-dim` `--font-num` rows), refined
  surface/spacing, and a subtle fade+rise entrance **frozen under `prefers-reduced-motion`**.
  All semantic tokens (no hex), so it tracks the theme.

**Decision (where it is computed).** Pure presentation, web-only (CLAUDE.md rule 2 untouched — no
nutrition figure is computed; the tooltip only formats values it already receives). `TooltipPoint.tip`
changes from `string` to a structured `TipContent { title: string; rows: string[] }`; the flip/clamp
is a `useLayoutEffect` measurement in `ChartTooltip` against `window`.

**Spec impact:** `design/components/charts.md` (§Shared chart primitives — Tooltips bullet rewritten:
multi-line layout + caret + in-viewport positioning + entrance). **Code (web-only):**
`components/Chart/ChartTooltip.tsx` (structured `tip` + clamp), `Chart.module.css` (`.tipTitle`/
`.tipRow`/`.below` + caret pseudo-elements + entrance keyframes), tip builders in `WeightChart.tsx`,
`features/stats/components/MonthlyBars.tsx` + `MonthCalorieBars.tsx`, `HitAreas.tsx` (`HitPoint.tip`
→ `TipContent`); i18n `stats.monthly.tooltip` split into `tooltipOk`/`tooltipNok`. Test:
`ChartTooltip.test.tsx` (bold title + one node per row). No DB/schema/API/DTO change.

**Follow-up (author, 2026-06-11, same day).** The first pass (commit `e8fd548`) did not actually
keep the card in the viewport: it was `position:absolute` **inside** the chart's horizontal-scroll
wrapper (`ScrollBlock`, `overflow-x:auto`), which **clipped** it on mobile (truncated, mispositioned
left of the column). Per author feedback the card is reworked into a **proper, useful tooltip**:

- **Escape the overflow.** The card is now **portaled to `<body>` and `position:fixed`** at the
  hovered point's **client coords** (mapped via the SVG `getScreenCTM` — new `Chart/anchor.ts`
  `svgPointToClient`). The flip/clamp now measures against the real viewport and works everywhere.
  `ChartTooltip` takes a resolved `TooltipAnchor { x, y, tip }` instead of `(point, box)`; the hit
  layers (`HitAreas`/`ColumnHits`/heatmap cells) compute the client anchor on hover.
- **Readable title, centered + larger.** Title is a **full date**: `Février 2026` for a month column
  (new capitalized `monthYearLabel(month, year, locale)`, so the bars get the **year** via a new
  `year` prop threaded from `AdherenceSections`), `10 juin 2026` for a weigh-in (`formatDate`), the
  cell's full date for the heatmap. `.tipTitle` is `text-align:center` + `--fs-12`.
- **Self-describing rows.** `21 jours OK` / `10 jours NOK` (i18n `stats.monthly.tooltipOk/Nok` →
  "{{ok}} jours OK"); avg-kcal `Moyenne des jours OK/NOK/globale : {{v}} kcal` (new `stats.calorie.*`
  keys, OK/NOK rows omitted when absent); heatmap `1600 kcal` + status.
- **Heatmap styled too (author-approved this run, contract change).** The dense heatmap's native
  `<title>` is replaced by the same styled tooltip (was kept native by the prior contract). `Heatmap`
  tracks a hovered anchor + new pure `cellTip` helper.

**Follow-up spec impact:** `design/components/charts.md` (§Shared primitives Tooltips bullet +
heatmap line rewritten — all charts incl. heatmap use the styled card; portal/fixed + full-date
centered title + self-describing rows). **Code (web-only):** new `Chart/anchor.ts`; `ChartTooltip.tsx`
(portal + `TooltipAnchor`); `Chart.module.css` (`position:fixed`, `--z-toast`, centered `--fs-12`
title); `HitAreas.tsx`/`ColumnHits.tsx` (emit client anchor); `WeightChart.tsx` (`formatDate` title);
`MonthlyBars.tsx`/`MonthCalorieBars.tsx` + `AdherenceSections.tsx` (`year` prop, `monthYearLabel`,
labelled rows); `Heatmap.tsx` (`cellTip` + styled tooltip); `format.ts` (`monthYearLabel`); i18n
`stats.calorie.*` + reworded `stats.monthly.tooltip*` (fr + en). Tests: `ChartTooltip.test.tsx`
(portal via `screen`), `Heatmap.test.tsx` (`cellTip` rounding + non-logged). No DB/schema/API/DTO change.

---

## FU-1 / B-151 — food/recipe search-picker ordering by usage — RESOLVED (user, 2026-06-11)

**Problem.** The search **pickers** listed foods (and loggable recipes) **A→Z by name**, so the
foods the user logs most often sank below rarely-used ones and had to be scrolled past.

**Decision (behaviour).**

- **Usage = count of meal logs over the last 90 days**, ties broken by **most-recent use**, then
  **name**. Decay is implicit: a food not logged within the window drops to count 0 and sinks to the
  alphabetical tail. The window is `FOOD_USAGE_WINDOW_DAYS = 90` (shared tuning constant).
- **Most-used-first becomes the default** for the **search pickers**: the Repas food picker and the
  recipe-ingredient picker (both via `GET /search/loggable`), and the garde-manger pantry picker
  (via `GET /foods?sort=usage&dir=desc`). Recipes rank by **their own logged usage** (their derived
  `food` row is referenced by `meal_entry.food_id`, so one per-`food_id` aggregation covers both).
- **The Aliments management page keeps its A→Z default**, and **gains a sortable "Utilisation (90 j)"
  column** that shows the per-food 90-day count (desktop column + mobile Trier option + a count line
  on the mobile card when usage-sorted). _(User picked the visible-count option; default stays
  alphabetical; sort offered on mobile too.)_

**Decision (where it is computed).** Usage is **derived at query time** from `meal_entry` — **no
stored column / no migration** (CLAUDE.md rule 2: the web reads the order, never computes it). New
`api/src/data/repositories/food-usage.ts`: `foodUsageMap(userId, foodIds)` (90-day COUNT + MAX(date)
per food, user-scoped via `day_log`, extending the AI `lastEatenMap` pattern) + a pure `rankByUsage`
comparator (count → recency → name → id). `loggable.repo.ts` fetches the full match set, ranks, then
takes the page; `food.repo.ts` adds a `sort=usage` branch that ranks the match set and paginates by
**cursor-id slicing** over the deterministic order (other sorts keep the DB keyset path). The
usage-sorted Food carries a `usage` integer (absent on other sorts).

**Spec impact:** `spec/api/foods-recipes.md` (`GET /foods` `sort` enum + `usage` semantics + the
`usage` response field; `/search/loggable` ordering). `shared/dto/food.ts` (`FOOD_SORT_FIELDS`
gains `usage`; `FoodSchema.usage?`), `shared/constants/tuning.ts` (`FOOD_USAGE_WINDOW_DAYS`).
`specifications/screens/food-db.md` (sortable Utilisation column, A→Z default kept, mobile),
`meals.md`/`recipe.md`/`settings.md` (picker = most-used-first). **Code:** api `food-usage.ts`,
`loggable.repo.ts`, `food.repo.ts`, `services/foods.ts`; web `settings/useFoodPicker.ts`,
`foods/components/FoodTable.tsx`/`FoodRow.tsx`/`FoodsMobile.tsx`/`FoodCard.tsx`; i18n `foods.col.usage`
(fr + en). Tests: `food-usage.test.ts` (ranking) + integration (`/search/loggable` + `/foods?sort=usage`
90-day window; default `/foods` stays A→Z). **No DB/schema change.**

## FU-2 / B-157, B-156 — food-usage fixes: consumed-only count + always-present column — RESOLVED (user, 2026-06-11)

**Problem.** Two defects in the shipped FU-1/B-151 usage feature. **(B-157)** The 90-day usage
count included `meal_entry` lines with **quantity 0** — the unfilled pinned placeholder lines
(B-045) — so a food pinned on many days but never actually eaten (e.g. "Framboises" always at 0 g)
outranked genuinely-consumed foods in the pickers and the Aliments column. **(B-156)** The
"Utilisation (90 j)" column was blank on the default A→Z Foods view and only filled when sorting
by usage, because the count was computed only on the `sort=usage` path.

**Decision (behaviour).**

- **B-157 — usage counts only consumed entries.** A meal line counts toward usage only when
  `served_quantity > 0`; quantity-0 placeholder lines do not count. This refines the FU-1
  definition ("count of meal logs") to "count of **consumed** meal logs". Applies uniformly to
  both callers (the Aliments column / `sort=usage`, and the `/search/loggable` + pantry pickers),
  since both derive from the same `foodUsageMap`.
- **B-156 — the count is always shown.** Every `GET /foods` list response carries the `usage`
  integer on each Food, regardless of `sort`, so the column shows the 90-day count on the default
  A→Z view without first sorting by usage. (The single `GET /foods/:id`, create, and update
  responses still omit `usage` — the change is about the list.)

**Decision (where it is computed).** Still derived at query time, no stored column / no migration.
**B-157:** add `servedQuantity > 0` to the `meal_entry` filter in
`api/src/data/repositories/food-usage.ts` `foodUsageMap` (the same `servedQuantity` filter already
used by `entry.repo.ts` B-045 unpin cascade). **B-156:** on the non-usage sort path in
`food.repo.ts` `list`, after slicing the page, compute `foodUsageMap` for the page's food ids only
(the page is already paginated — no full-catalog scan) and attach the count to each row; the
`sort=usage` path already attached it. `services/foods.ts` `toDto` already emits `usage` whenever
the row carries it — no change.

**Spec impact:** `spec/api/foods-recipes.md` (`GET /foods` `usage` semantics: consumed-only +
present on every list response; `/search/loggable` consumed-only note). `shared/dto/food.ts`
(`usage` JSDoc updated). **Code:** api `food-usage.ts`, `food.repo.ts`. Tests:
integration `food-usage.test.ts` (qty-0 lines score 0 and never outrank a consumed food; default
`/foods` now carries the count). **No DB/schema change.**

## MS-1 / B-146, B-147, B-148, B-149 — Mobile overlays collapse to a single bottom-sheet variant — RESOLVED (user, 2026-06-11)

**Problem.** The mobile (≤560px) overlay taxonomy had **three** presentations selected by a
`Modal` `mobile?` prop: `fullscreen` (big forms), `sheet` (short editors/menus), and a
_centered-on-mobile_ dialog (confirmations, no prop). This was inconsistent — the same
confirmation was centered on a primary screen but a sheet on an account-menu page (the 2026-06-11
exception), and big forms hid the bottom nav.

**Decision (owner).** Collapse to **one mobile overlay language: every modal is a bottom sheet on
mobile.** Owner-directed choices this session: **(1) scope = every modal** — the sheet is the
_default_ mobile rendering of `Modal`, applied app-wide (including the unlisted weigh-in
date-conflict confirmation `ConflictConfirm` and any modal added later); the `fullscreen` and
centered-on-mobile variants are **retired**. **(2) uniform height** — big forms reuse the standard
sheet height (`max-height: calc(90dvh - 56px)`, body scrolls); no dedicated tall-sheet treatment.

**Mechanism.** `Modal` now selects the sheet unconditionally on mobile (`variant = isMobile ?
'sheet' : undefined`) — the `mobile?` prop is **removed** entirely. The `.fullscreen`/`.scrimFull`
CSS is deleted; `.sheet`/`.scrimSheet`/`sheet-up` and the footer-tightening rules are kept.
Desktop ≥561px is **byte-identical** (`variant` is `undefined` → no extra class/markup). Items
B-146 (ParseLabelDialog), B-147 (AiProposalsDialog) and B-148 (the six primary-screen
confirmations: clear-day, meal-delete, copy-yesterday, convert-to-summary, food-archive,
recipe-archive) become sheets **with no callsite change**; B-149 (food/recipe/weigh-in big forms)
drop their `mobile="fullscreen"`. The now-redundant `mobile="sheet"` props and the wrapper
plumbing (`FoodModal`/`RecipeBuilderModal`/`WeighInModal`/`ContainerModal` + their pages) were
stripped.

**Contract impact:** `design/components/modals.md` (rewrote "Mobile variants" → single bottom-sheet
presentation; collapsed the overlay-taxonomy table to one row; deleted the account-menu-pages
exception block) and `design/components/mobile.md` (single bottom-sheet row; dropped the stale
`cibles`/`Repas food picker` full-screen entries). **No DB/schema/API/DTO/token change.** Cosmetic/
layout change — visual acceptance ≤560px; no dedicated domain test. typecheck + lint + web suite green.

## AC-2 / B-152 — Activity-level palette recolour (five distinct hues) — RESOLVED (user, 2026-06-11)

**Problem.** The five activity levels shared a single red→yellow→green ramp whose upper three levels
were near-identical greens — Modéré `color-mix(--ok 45%, --accent)` (a pale, washed-out green that
failed to convey a decent activity level), Intense `color-mix(--ok 75%, --accent)`, Très intense
`--ok`. In the 16 %-opacity soft tints used on the controls these barely differed.

**Decision (improvement, web + design only; supersedes B-085/B-101/WV-1 colour _values_).** Replace
the ramp with **five distinct, correctly-ordered hues**: Sédentaire `--nok` (red, unchanged) → Léger
`--accent` (yellow, unchanged) → **Modéré `--ok`** (solid green) → **Intense `--blue`** (new token,
blue) → **Très intense `--violet`** (new token, violet). The owner picked the blue→violet top
(option C) over a teal→indigo variant because green→teal read as near-identical in the 16 % soft tint;
blue→violet maximises the separation across the three upper levels. The tint
**mechanism** (B-101 whole-control tint: 16 % soft bg + 45 % border + `--act-color` band) is unchanged
— only the per-level source colour changes. No DB / API / DTO / domain-logic change; `shared`
unchanged (`constants/activity.ts` carries no colour).

**Contract delta.** Two theme-aware tokens added to `design/tokens.css` **and** its byte-identical
copy `packages/web/src/styles/tokens.css` (both themes): `--blue` (dark `#4a93e6` / light `#2f6fb0`),
`--violet` (dark `#9a7bf2` / light `#6a4fcf`). Docs updated: `design/components/metric-cards.md`
(verdict-cluster activity select) + `design/components/data-tables.md` (period pill + mobile card
summary). `design/tokens.md` not touched (it documents only non-colour scales; `tokens.css` is the
colour authority). B-085 + B-101 entries above annotated as colour-values-superseded (mechanism kept).

**Code (web, CSS-only).** The five level classes recoloured in the three palette-consuming modules —
`components/ActivitySelect/ActivitySelect.module.css`, `features/journal/journal-mobile.module.css`,
`features/weight/weight.module.css` — only the Modéré/Intense/Très intense values change; header
comments updated. No `.tsx` change (classes applied by name). Surfaces: ActivitySelect (Repas +
Journal desktop/mobile sheet), JournalCard (mobile read-only), Poids `PeriodRow`/`PeriodDetailSheet`.

**Acceptance.** Visual check at every surface in light + dark (five distinct, correctly-ordered
tints); lint + typecheck + full suite green. Cosmetic — no dedicated domain test (palette carries no
logic).

## PWA-1 / B-142, B-143, B-144 — Installable PWA + native capabilities — RESOLVED (user, 2026-06-11)

BACKLOG PWA-1 (second-to-last batch). Turns the already-mobile SPA into an **installable** PWA and
adds two phone-native touches. **Improvement batch** (new contract surface). New ADR-0003 is the
authoritative record of the deployment-neutral PWA shape (app-shell service worker, **no offline
data**, served as static files by the existing `serveSpa` — no ADR-0001 conflict).

**B-142 — installable + silent auto-update + manual refresh + version.** `vite-plugin-pwa` (Workbox)
emits the `manifest.webmanifest` (`display: standalone`, `start_url: '/'`, theme/background, icons) +
a service worker precaching the **app shell only**; `navigateFallbackDenylist: [/^\/api\//]` mirrors
`serveSpa`. **Owner decision — silent updates:** a new build installs in the background and activates
on the **next launch** (no in-session prompt, no surprise reload); a manual **"Forcer la mise à jour"**
button in Paramètres forces immediate activation + reload. A `theme-color` meta tracks the live `--bg`
token (OS status bar follows the theme; no raw hex — read via `getComputedStyle`). **Owner decision —
version display:** the running version is shown on the update card, read from `GET /api/v1/health`;
this **lifts the ADR-0002 "web display deferred" note** (ADR-0002 amended).

**B-143 — camera capture (mobile).** **Owner decision:** a **separate "Prendre une photo" button**
beside "Ajouter des photos" in the AI dish-photo dialog (a single-shot `capture="environment"` input),
shown **only on the phone layout** (`useIsMobile()`), feeding the same base64 picker; gallery
multi-select is preserved; desktop unchanged.

**B-144 — native (scoped by owner).** **Install invite** (Android/Chromium `beforeinstallprompt`) as
an "Installer l'app" button in the update card, hidden once installed/standalone or where the event
never fires (**iOS Safari → no in-app hint**, by decision). **Haptics** — light `navigator.vibrate` on
two key successes (adding a Repas entry, applying an AI proposal), silent no-op where unsupported.
**Web Share and barcode scan are excluded** (owner).

**Icon (owner-validated).** New PWA mark: transparent exterior, opaque **dark inner disc** (`#0d0f12`)
filling the ring, **thicker** amber ring + needle, central pivot dot. Maskable + apple-touch composite
on the dark disc (opaque). The existing `favicon.svg` and the `00-foundations.md` brand mark are
**unchanged** (new asset, not a brand-mark redefinition). Icons are pre-generated once
(`@vite-pwa/assets-generator`, manual `gen:icons`) and committed under `packages/web/public`, so CI /
Docker need no `sharp`.

**Contract delta.** New `docs/architecture/decisions/0003-pwa.md`; ADR-0002 amended (version display
lifted); new `design/components/pwa.md`; `design/components/ai-dish-analysis.md` amended (camera
button). Local (git-ignored, not committed): `specifications/screens/settings.md` (update card) +
`specifications/screens/meals.md` (camera button). No API / schema / migration / DTO change (only the
already-public `/health` is read).

**Acceptance.** Behavioural unit tests: `syncThemeColor`, `registerSw.forceUpdate`, `useInstallPrompt`,
`UpdateCard` version line, `haptics` no-op guard, `AiDishAnalysisDialog` mobile camera input. Web build
produces `dist/sw.js` + `manifest.webmanifest` + icons. Full web suite + typecheck + lint + check:i18n
green. Device check (install/standalone/update/camera/haptics) deferred to the owner.

---

## DH-1 — Mobile Repas date band: single line + 4-letter month + swipe (B-153, B-154) — RESOLVED

Refines the archived two-row mobile day bar (B-054). Two owner-approved deltas to the
mobile date band (≤560px), code + contract:

- **B-153 — single line, 4-letter month.** The compact date renders on **one line, no wrap**.
  **Owner decision:** the localised month is abbreviated to its **first 4 letters, in any
  language** (fr janv/févr/mars/avri/mai/juin/juil/août/sept/octo/nove/déce; en
  Janu/Febr/…/June/July/…) — 4 letters keeps juin/juil and June/July distinct; **no trailing
  period**. The date text and the "⋯" day-menu trigger are slightly trimmed to fit.
- **B-154 — swipe to change day.** A horizontal swipe on the date band navigates day-to-day:
  **swipe-left = next, swipe-right = previous**, parity with the ‹ › arrows; reuses the
  existing `useMealSwipe` hook (same `dir −1/+1` convention as the meal-tab swipe). The
  arrows/calendar/⋯/comment controls keep their own taps (hook ignores gestures starting on
  a button/input/menu).

**Rationale:** keeps the refined two-row day bar on one line on narrow phones without
losing month legibility, and adds a thumb-friendly day navigation that mirrors the existing
swipe language — no desktop change (all rules are `@media (max-width:560px)` / `useIsMobile()`).

**Contract delta.** `specifications/screens/meals.md` (responsive ≤560px date-band note) +
`design/components/mobile.md` (single-line abbreviated date header + date-band swipe
convention). Bundled in the same change: **B-155** — a mobile-only **bug** fix (the row-2
day-comment input overflowed the right edge; `min-width:0` lets the flex item shrink to the
bar's padding edge) — code-only, conforms to the B-054 layout, **no contract change**. No
API / schema / DTO change.

**Acceptance.** `formatDateLabelShort` unit test extended (long month → first 4 letters).
Web suite + typecheck + lint green. Visual checks (one-line date, swipe day-nav, comment
alignment at ≤560px) deferred to the owner.

---

## DS-1 — AI dish-photo "no food detected" status (B-160) — RESOLVED

The AI dish-photo analysis previously forced the model to _always_ estimate the six fields
(`spec/logic/ai-dish-photo-macros.md` §3), so a photo with no identifiable food leaked the model's
refusal into the **`dish_name`** field, which `applyAnalysis` then pre-filled into the custom-entry
**name** — polluting the line with a sentinel string.

**Decision (owner-approved):** add a **`detected` boolean** to the hard-coded response-format
contract. The model sets `detected:false` **only** when no food can be identified at all (numeric
fields then `0`); otherwise `detected:true` and estimates every field as before. On `detected:false`
the analysis dialog **stays open** and shows an **info banner** ("Aucun aliment détecté sur la
photo. Reprends une photo ou ajoute une description.") and **nothing is pre-filled**; on
`detected:true` the behaviour is unchanged. The parser treats a **missing `detected` as `true`**
(back-compat with the pre-B-160 format) and, on `detected:false`, short-circuits to a zeroed result
without validating the other fields (so a model that returns nulls/empty fields alongside the flag
doesn't trip `ai_bad_response`).

**Rationale:** surfaces "no food" cleanly at the point of analysis instead of polluting the form,
without changing the happy path. It is also the prerequisite for **QP-1/B-158** (the mobile one-tap
photo flow must, on "no food", show the message and not open the custom modal).

**Contract delta.** `spec/logic/ai-dish-photo-macros.md` §3/§4/§5/§7 (the `detected` field, parse
short-circuit, no-mapping note, new oracle 6b); `spec/api/ai.md` (response example +
`detected`); `packages/shared/src/dto/ai.ts` (additive `detected: z.boolean()` on
`DishPhotoMacrosSchema`); `design/components/ai-dish-analysis.md` (no-food state); i18n key
`meals.aiAnalysis.noFood` (fr/en). **No DB / API-shape change** beyond the additive DTO field.

**Acceptance.** API parse tests extended (`detected:false` → ok/zeroed/no validation;
`detected:true`/absent → mapped with `detected:true`); web `AiDishAnalysisDialog` test
(`detected:false` shows the message + does not call `onApplied`; `detected:true` applies). Full
suite + typecheck + lint green; mobile/desktop visual check deferred to the owner.

---

## QP-1 — Mobile one-tap photo meal entry (B-158) — RESOLVED

A streamlined mobile entry point that composes existing pieces — no new behaviour in the API, DB,
DTO, or domain (web-only). Owner-approved.

**Decision.** On the **phone layout (≤560px) only**, the meal-column header shows a **📷 button with
a "+" badge** in the slot of the (CSS-hidden ≤560px) 🍳 cuisine button. Tapping it opens the
**device camera directly** (single shot, no note), **auto-runs** the existing dish-photo analysis
(`POST /ai/dish-photo-macros`), and on success opens the **`CustomFoodModal` pre-filled** on the
**shown meal** at the **first free slot**, where the line is created on validation. On **"no food
detected"** (DS-1/B-160) it shows the no-food message and does **not** open the modal; on error a
**dismissible** banner under the header, nothing added. The button is shown **only when the
`dish_photo_macros` task is configured** (link + key + a vision model, B-117) and is **hidden on
desktop** (which keeps the 🍳 button + the in-modal "Analyse par IA" path unchanged). It is a second
entry point to the **same** analysis, not a new AI use.

**Implementation notes (web).** Reuses `capture="environment"` (B-143), `useDishPhotoMacros`
(B-118), the `detected` flag (DS-1), and the `order_index` slot model (B-028). The
camera→analyse→prefill wiring lives in a new `useMealPhotoEntry` hook; a pure `firstFreeSlot(entries)`
helper (in `logic/lineRows.ts`) computes the insertion row (first empty row, skipping garde-manger
qty-0 placeholders, else append). To pre-fill a **new** custom line, `openCustom` gained an optional
`prefill` carried on `CustomTarget`, and `CustomFoodModal`'s add/edit title now derives from
`target.entryId` (so a prefilled new line still reads "Ajouter"). `readAsDataUrl`/`ACCEPT` and the AI
error-code mapping were extracted to `features/meals/lib/` and shared with `AiDishAnalysisDialog`.

**Rationale.** Cuts the photo→line path on mobile from ~5 steps to one tap, reusing the existing
analysis verbatim. Desktop is untouched.

**Contract delta.** `specifications/screens/meals.md` (mobile one-tap entry in the Repas AI note);
`design/components/ai-dish-analysis.md` (new mobile trigger section) + `design/components/mobile.md`
(one line); i18n key `meals.photoEntry.button` (fr/en). **No** `spec/logic/ai-dish-photo-macros.md`,
API, schema, or DTO change.

**Acceptance.** `firstFreeSlot` unit test (gaps / placeholders / append); `macrosToCustomValues`
mapping test; `useMealPhotoEntry` test (gating; `detected:true` → `openCustom` at first free slot
with prefill; `detected:false` → no-food message, no open; error → warning, nothing added). Full
suite (459) + typecheck + lint green; mobile camera/visual check deferred to the owner.

---

## PK-1 — Repas picker: custom option first when empty (B-159) — RESOLVED

A small web-only UX refinement to the "+ aliment" picker. Owner-approved.

**Decision.** The **"+ Valeurs manuelles (custom)…"** option is shown **first** (leading row) when
the search field is **empty** — the common case when opening a brand-new line, where manual entry is
often what the user wants — and **returns to last** (trailing row) **as soon as text is typed**,
which is the prior behaviour. While searching it therefore stays at the bottom and does **not**
interfere with Enter/Tab selecting the first matching food (**B-023 preserved**); the custom option
is never keyboard-highlighted (mouse/tap only). Applies on **desktop** (the shared `Autocomplete`)
and **mobile** (`FoodPickerSheet`). "Empty" = the **trimmed** query is empty (parity with the
Autocomplete Tab handler's convention).

**Rationale.** Puts the most likely action one tap away on an empty picker without changing the
search ergonomics once the user starts typing.

**Contract delta.** `design/components/forms-inputs.md` (custom option = leading when empty, trailing
while searching) + `specifications/screens/meals.md` (picker note). **No** i18n, API, schema, DTO,
domain, or keyboard-behaviour change (B-023/B-105 intact).

**Acceptance.** `Autocomplete` test extended (B-159): custom precedes the first item on an empty /
whitespace query, follows it once typing; the existing B-023 Enter/Tab tests stay green. Full suite
(462) + typecheck + lint green; mobile `FoodPickerSheet` visual check deferred to the owner.

---

## DK-2 — Day-kind selector aligned to the verdict badge (B-161) — RESOLVED

A cosmetic, web-only CSS alignment. Owner-approved.

**Decision.** The Repas day-line **Complet/Partiel chip** (`DayKindBadge`) is sized to **match the
OK/NOK verdict badge** (`badges-verdict.md` §A) in **height** and uses the **`--r-md`** corner radius
(instead of `--r-pill`), while **keeping its compact type** (`--font-num`, `--fs-10` uppercase) and
its **compact horizontal padding** (`3px 8px` desktop / `4px 7px` mobile, unchanged). The added
height comes from a `min-height` (≈30px desktop, ≈28px mobile, matched to the verdict badge) plus the
chip's existing flex centering — **not** from L/R padding. The verdict badge is untouched (the two
are separate CSS, not a shared primitive).

**Rationale.** The two clickable badges sit side by side on the day line; matching height + radius
makes them read as a consistent pair. Resolves a contradiction in `badges-verdict.md` §D, which said
"same metrics as §A" while the realized chip was a compact `--r-pill` pill.

**Contract delta.** `design/components/badges-verdict.md` §D — rephrased: the chip keeps its compact
font + L/R padding but is sized to §A's height and uses `--r-md`. **No** API/DB/DTO/domain/i18n/
behaviour change; CSS only.

**Acceptance.** Cosmetic — **no dedicated test**. Full suite + typecheck + lint green; the exact
height (≈30/≈28px) is matched to the verdict badge and visually verified by the owner (desktop +
mobile).

## B-166 — Orange verdict badge for NOK days still in a deficit — RESOLVED (user, 2026-06-13)

First of run #39's two-batch NOK tri-colouring. **Improvement batch** (contract amended
first). Introduces the shared orange token + the NOK sub-tone rule that B-167 (Stats) reuses.

**Decision.** The binary OK/NOK verdict (`day-snapshot-verdict.md` §5–§6) is **unchanged**; only the
**presentation of a NOK day** splits. A NOK verdict badge is rendered **orange** when the day is still
in a real calorie deficit (`intake <= the day's estimated burn`, i.e. the server `deficit`/`burn_gap
<= 0`) and **red** on a surplus (`> 0`) **or when the burn cannot be computed** (no weigh-in on/before
the date, or an incomplete profile -> `null`). **OK is unchanged (green).** The comparison always uses
the **day's own** `estimated_burn` (BMR of the weight in effect on that date x that day's
`activity_level`), never a global/current value, and does **not** read `cal_min`/`cal_max` (a `SOUS`
under-the-floor NOK day is orange like any other deficit — owner-decided).

**Rationale.** On already-NOK days, orange vs red distinguishes "over the target but still losing"
from "in surplus / unknown", which the single red tone hid. The figure is already on the wire
(`JournalRow.burn_gap`, `DayDetail.constat.deficit`), so the web only picks the colour class from its
**sign** — no web-side verdict compute (CLAUDE.md rule 2; precedents WV-1/B-115, JX-1/B-163).

**Contract delta.** New theme-aware token pair **`--warn` / `--warn-soft`** added to `design/tokens.css`
**and** its byte-identical copy `packages/web/src/styles/tokens.css` (dark `#e0913f`/`#3a2410`, light
`#c9702a`/`#f6e6d4`; orange, distinct from `--accent` amber and `--nok` red — hue owner-tunable, AC-2
precedent). Docs: `design/components/badges-verdict.md` §A + §B (NOK deficit sub-tone),
`design/components/data-tables.md` (verdict cell), `spec/logic/day-snapshot-verdict.md` §7 (NOK
presentation split, per-day burn basis restated), `specifications/screens/meals.md` + `history.md`. **No**
API/DB/DTO/domain/i18n change.

**Code (web).** `VerdictBadge` gains a `belowBurn?: boolean | null` prop (orange `.warn` only when
`true`; `false`/`null` -> red); callers derive it from the existing figure — `JournalRow`,
`JournalDaySheet` from `burn_gap`, `DayHeader`->`DayVerdictBadge` from `constat.deficit`. The mobile
`JournalCard` static pill gains a tri-tone `.badgeWarn` class (it does not use `VerdictBadge`).

**Acceptance.** Behavioural -> dedicated RTL tests: `VerdictBadge` (orange when NOK & `belowBurn`,
red when NOK & not / null, green when OK) + `JournalRow`/`JournalCard` colour cases. Full suite +
typecheck + lint + check:i18n green; orange hue visually verified by the owner (both themes).

## B-167 — Third orange tone for NOK-in-deficit on the Stats heatmap + monthly bars — RESOLVED (user, 2026-06-13)

Second batch of run #39 (extends B-166's `--warn` token + NOK tri-tone rule to the Stats screen).
**Improvement batch** (contract amended first).

**Decision.** The Stats **heatmap** and **monthly OK/NOK bars** split a NOK day by the day's
expenditure, exactly like the verdict badge (B-166): **orange** when still in a real deficit
(`day_kcal <= estimated_burn`) and **red** when in a surplus (`> estimated_burn`) **or when the burn
cannot be computed** (no weigh-in on/before the date, or an incomplete profile). **OK stays green.**
The `estimated_burn` is the **day's own** figure — `BMR(weight in effect on the date) x
activity_multiplier(that day's activity_level)`, the same per-day basis as the Journal `burn_gap`
(`spec/logic/day-snapshot-verdict.md §7`) — never a global/current value; it does **not** read
`cal_min`/`cal_max` (a `SOUS` NOK day is orange like any other deficit). The binary OK/NOK verdict is
unchanged; only its NOK presentation splits.

**Why.** Parity with B-166 on the at-a-glance Stats surfaces: on already-NOK days, orange vs red
distinguishes "over the target but still losing" from "in surplus / unknown", which the single red
tone hid.

**Data — the heavy part (no recompute).** The per-day burn was not in the Stats DTO. The Stats read
path now reuses the Journal machinery **verbatim**: `loadBurnContext`/`burnGapFor`
(`services/journal-burn.ts`) over the metabolic engine (`domain/metabolic/*`) + the weigh-in series,
each day with its own weight + `activity_level`. `getAdherence` loads the burn context once and passes
it to `toDayStats`; `DayStat` gains `burnGap: number | null`; `LightDay` gains `activityLevel` (the
column already exists — **no schema/migration**, computed on read). `getRolling` does not need it
(burn unused there).

**Contract delta (additive DTOs).** `HeatmapCell.status` enum `'OK' | 'NOK_under' | 'NOK_over' |
'none'` (the `'NOK'` value splits — only consumer is the web, updated in lockstep). `MonthlyStat`
gains `nok_under_count` + `nok_over_count` (`nok_count` **kept** = their sum, so `MonthCalorieBars` and
the existing tooltips are untouched). Docs: `spec/logic/stats-adherence.md §3-4`,
`spec/api/weight-targets-stats-settings.md §Stats`, `design/components/charts.md` (heatmap + monthly
bars + legends), `specifications/screens/stats.md`. Reuses B-166's `--warn` token (no new token). **No**
DB/schema change.

**Code.** Domain: `domain/stats/util.ts` (`DayStat.burnGap` + `heatStatus`/`nokSubStatus` helpers),
`heatmap.ts` (sub-status), `monthly.ts` (under/over split). Service: `day-stat.ts`
(`dayStat`/`toDayStats` take an optional burn context), `stats.ts` (`getAdherence` loads it),
`day-stat.repo.ts` (`activityLevel` in the light read). Web: `Heatmap` (3-class fill + `.warn`),
`MonthlyBars` (3rd orange segment + legend swatch), i18n (`stats.status.NOK_under/NOK_over`,
`stats.legend.nokUnder/nokOver`, `stats.monthly.tooltipNokUnder/tooltipNokOver`). `MonthCalorieBars`
untouched (owner scope).

**Acceptance.** Neutral domain oracles in `domain/stats/stats.test.ts` for the heatmap sub-status
(incl. an unknown-burn -> red case) and the monthly under/over split; an integration test seeding a
weigh-in so a NOK day reads `NOK_under` (and one with no weigh-in reads `NOK_over`); web suite for the
3-class heatmap + 3-segment bars + legend. Full suite + integration + typecheck + lint + check:i18n
green; orange already owner-tuned (B-166). Visual check of the heatmap + bars deferred to the owner.

## B-169 — Monthly OK/NOK bars: OK% inside the green segment + 3-share tooltip — RESOLVED (user, 2026-06-13)

Small Stats UX refinement on the monthly OK/NOK stacked bars (`MonthlyBars`). **Improvement** (touches
the `charts.md` label-placement rule) — directed and specified by the owner.

**Decision.** The **OK% label** moves from above the bar to **inside the top of the green (OK)
segment** — it is the OK-days share, so it belongs in the OK days. When the green segment is too short
to hold the label, it falls back to **above the bar** as before. The two NOK shares are **still not
labelled on the bar** (only OK%). The per-month **tooltip** now lists **all three shares with count +
percentage** (over the month's logged days), e.g. `16 (52%) jours OK` / `3 (10%) jours NOK (déficit)` /
`12 (39%) jours NOK (surplus)`.

**Code (web only).** `MonthlyBars.tsx`: the OK% `<text>` is drawn inside the green segment
(`base − okH + 11`, class `.barLabelIn`) when `okH ≥ 14` px, else above (`.barTop`, unchanged); the
tooltip rows pass `pct(share)` for OK/NOK-under/NOK-over. New `.barLabelIn` in `stats.module.css`
uses `fill: var(--bg)` so the ink contrasts on the `--ok` fill in both themes (dark bg on the lighter
dark-theme green, light bg on the darker light-theme green). i18n `stats.monthly.tooltip*` gain a
`{{pct}}` slot. **No** DTO/API/domain change (counts/rate already on the wire).

**Contract delta.** `design/components/charts.md` — the monthly-bars label rule (OK% inside the green
segment, fallback above; NOK shares unlabelled) + the tooltip example (three count+percentage rows).

**Acceptance.** Web test: the OK% uses `.barLabelIn` when the green segment is tall, `.barTop` when
short (deterministic — depends on counts, not layout). Full suite + typecheck + lint + check:i18n
green; bar/tooltip visual check deferred to the owner.

## B-176 — Poids: open-interval row (last weigh-in → today) + reduced modal — RESOLVED (user, 2026-06-25)

The Poids table only derived periods **between two weigh-ins**, so the days logged **since the
last weigh-in** were invisible. **Improvement** (owner-directed; amends weight logic + schema +
api + design + screen contracts). Builds on the now-persisted `current_mode` (B-177).

**Decision.** Derive a **synthetic open interval** (last weigh-in → today) on read and show it as
a **lead row**.

- **Trigger:** `last_weigh_in.date ≤ today − 1 day` **and** ≥ 1 logged day in
  `(last_weigh_in, today]` (works even with a single weigh-in). Otherwise no open row.
- **Figures** over the open span (reusing the §2 metabolics): durée, apport moyen, déficit/j,
  and **dépense estimée = BMR(last weigh-in's weight) × span activity** (no closing weight → BMR
  on the last weight, age at today). **Dashed** (N/A without an end weight): poids, tendance
  (ema), Δ, écart trajectoire, IMC, taille, dépense empirique.
- **Régime = the screen Mode** (`current_mode`, single source of truth — no separate field).
  **Note** = a new persisted **open-period note** on `app_user.settings`
  (`open_period_note`, string|null, same JSON column as `current_mode`, **no migration**).
- **Reduced modal:** clicking the open row opens `WeighInModal` in an **open mode** — only note
  - régime editable; date/weight/waist hidden; no Delete; Save = one
    `PATCH /settings {current_mode, open_period_note}` (writes no weigh-in).
- **"+ Pesée" pre-fill:** the add modal pre-fills note from `open_period_note` + flag from
  `current_mode`; creating the closing weigh-in carries the note onto it and **clears**
  `open_period_note`.

**Transport (internal).** `GET /weight` gains `open_period: Period | null`; `Period.weight_end /
ema / delta` become nullable and `Period.open: boolean` is added (closed periods `open:false`).
`/settings` carries `open_period_note?: string | null`.

**Contract deltas.** `spec/logic/weight-periods-trajectory.md` (§2.1 open interval + neutral
oracle), `spec/schema/tables-weight-targets.md` (open-period note on settings),
`spec/api/weight-targets-stats-settings.md` (open_period + open_period_note),
`packages/shared/dto/{weight,settings}.ts`, `design/components/{data-tables,modals}.md`,
`specifications/screens/weight.md`.

**Acceptance.** Domain unit wired from the §2.1 neutral oracle (BMR 1730 × 1.2 = 2076 estimated
burn; avg_intake 2100; deficit +24; days 3). Integration: `GET /weight` emits `open_period` only
when triggered; the note persists (`PATCH /settings` → `GET /weight`), pre-fills the add form, and
is cleared after the closing weigh-in. Full suite + typecheck + lint green.

## B-179 — Poids: add modal pre-fills weight & waist from the last weigh-in — RESOLVED (user, 2026-07-04)

The "+ Pesée" add modal opened with empty _Poids_ / _Tour de taille_ fields even though the
previous weigh-in is the obvious starting point (near-daily measurements barely move).
**Improvement** (owner-directed; amends the screen contract only — web-only change, no API/DB
delta: the data is already in `GET /weight`'s `weigh_ins`).

**Decision.** In **add mode only**, pre-fill _Poids_ from the most recent weigh-in's
`weight_kg` and _Tour de taille_ from its `waist_cm` (empty when null, or when there is no
weigh-in at all). **Edit mode** keeps the edited weigh-in's own values; the **open-interval
reduced modal** (B-176) is unaffected (fields hidden). The note/flag pre-fill from B-176 is
unchanged. Known soft edge: the source is the (range-clipped) `weigh_ins` series, so a last
weigh-in older than the selected chart range falls back to empty fields — accepted.

**Contract deltas.** `specifications/screens/weight.md` (Entry / edit).

**Acceptance.** `WeighInModal` unit tests: add + last weigh-in → pre-filled (waist empty when
null); add without data → empty; edit ignores the prop. Full suite + typecheck + lint green.

## B-180 / B-181 — External integrations: Home Assistant weight import + Intégrations page — RESOLVED (user, 2026-07-04)

Two owner-directed improvements: import the latest smart-scale measurement from **Home
Assistant** into the weigh-in modal (B-180), configured — together with the
**BarclaudeGateway** local drive-product API used by B-182 — on a new **Intégrations**
account-menu page (B-181).

**Decision.**

- **Storage**: both connections live on the `app_user.settings` jsonb blob under a new
  `integrations` key (`{home_assistant, barclaude_gateway}`, each nullable), following the
  `settings.ai` pattern exactly — deep per-connection merge (secret absent = keep,
  `""`/`null` = clear), redaction to `token_set`/`api_key_set` on read, no DB migration.
- **Secrets are proxy-only**: the HA long-lived token and the gateway API key never reach
  the browser; all remote calls are server-side proxies under `/api/v1/integrations`
  (works from outside the LAN; the app server and the two hosts share the LAN). Plain
  `http://` base URLs are allowed — same SSRF stance as `ai.base_url` (single-owner
  self-hosted app; no URL allow-listing in v1).
- **HA read** (nothing built HA-side): `GET {base}/api/states/{entity}` with the Bearer
  token; the scale's `weight_entity_id` is **always user-supplied** (never defaulted in
  code); the imported weight is **rounded server-side** to the configured
  `weight_round_decimals` (int 0..3, default 1, round half up). Unit must be `kg`
  (SI-only, no conversion); `unavailable`/`unknown` state → `ha_no_measurement`.
- **Import button behaviour** (owner decision): fills the **weight field only**, shows
  the measurement date/time, warns **non-blockingly** when the measurement date ≠ the
  modal's date, and **never changes the modal's date**. Add mode only; visible only when
  HA is configured.
- **Connection proofs**: the HA card's "Tester" runs the weight read; the gateway card's
  runs `GET /api/v1/ping` (X-API-Key) — same "the useful call is the proof" +
  "persist then test" doctrine as `/settings/ai/models`. Outbound policy: 3 attempts on
  network/5xx only (never 401/404), timeouts ≤ 10 s HA / ≤ 8 s gateway.
- **Export/import (IMP-1)**: the settings blob round-trips verbatim, so the two secrets
  travel in the export exactly like `ai.api_key` — accepted (same stance).

**Transport.** New `spec/api/integrations.md` endpoints:
`GET /integrations/home-assistant/weight` → `{weight_kg, measured_at, unit, entity_id}`;
`GET /integrations/barclaude-gateway/ping` → `{status, version}`. New error codes
`ha_not_configured|ha_unauthorized|ha_entity_not_found|ha_no_measurement|ha_unavailable|ha_unreachable|ha_bad_response`
and
`gateway_not_configured|gateway_unauthorized|gateway_unavailable|gateway_unreachable|gateway_bad_response`.

**Contract deltas.** New `spec/logic/integrations-connections.md` (§1–§7 with worked
oracles) and `spec/api/integrations.md`; `spec/schema/tables-catalog.md` (settings JSON
`integrations` key, SECRET doctrine); `spec/api/weight-targets-stats-settings.md`
§Settings; `packages/shared/{errors.ts, dto/integrations.ts, dto/settings.ts}`; local
screen specs (new `integrations.md`, `weight.md` import button).

**Acceptance.** Domain oracles §3/§4 (merge/redact, per-connection isolation) + §5
rounding oracles; integration tests with stubbed outbound fetch (secrets never in any
response, one-connection patch isolation, `token:''` clears, error-code mapping table,
unconfigured → 409); e2e account-menu → page → persist → masked reload. Full suite +
typecheck + lint + CI green.

## B-182 — Chronodrive product search in the food-creation modal — RESOLVED (user, 2026-07-04)

Owner-directed improvement: create foods from real drive products. A **"Recherche
chronodrive"** link in the food modal (visible only when the BarclaudeGateway
integration, B-181, is configured) opens a search dialog; choosing a product pre-fills
the food draft.

**Decision.**

- **Two new gateway proxies** (`spec/api/integrations.md`):
  `GET /integrations/barclaude-gateway/search?q=` (Zod `q` trim min 3 → 422; the server
  always passes `size=10` upstream — the 10-result cap is server-side) and
  `GET /integrations/barclaude-gateway/products/:id` (id or EAN; upstream
  404/`not_found` → new code `gateway_not_found` 404).
- **Mapping is server-side** (rule 2 — the web never computes a nutrition figure):
  `food_prefill` per `integrations-connections.md §8.2` — macros mapped **only when
  `nutrition.base` is "100 g"/"100 ml"** (any other base → all four macros null, never
  rescaled); an absent field (manufacturer didn't declare it) → null, others kept; kcal
  from `energyKcal` only (never derived from kJ); `name = [brand, name].join(' ')`;
  `comment = unitQuantityLabel`.
- **Missing macros** (owner decision): fill what exists, leave the rest **empty**, show
  a non-blocking "à compléter" notice whose wording states that an empty macro field is
  **saved as 0** (existing `draftToBody` coercion — kept as-is, the notice is the guard).
- **No auto named-portion** from the product weight (owner decision). Strictly name +
  macros + comment.
- **Thumbnails** load browser-side from the gateway's public image URLs (non-secret);
  a failing image is dropped — images are not proxied in v1.

**Contract deltas.** `spec/logic/integrations-connections.md` §8 (+ §7 `gateway_not_found`
row) with worked oracles; `spec/api/integrations.md` (search/product endpoints);
`packages/shared/{errors.ts, dto/chronodrive.ts}`; local `specifications/screens/food-db.md`.

**Acceptance.** `chronodrive-map` domain tests wired from the §8.3 oracles first;
integration tests (X-API-Key + `size=10` asserted on the outbound stub, q too short →
422, `food_prefill` oracle, upstream `not_found` → 404, bad key → `gateway_unauthorized`,
unconfigured → 409); `FoodModal` unit tests (link gated on config, applyChrono fills the
draft, missing macro → empty field + notice). No e2e (external dependency; the mocked
integration layer covers the contract). Full suite + typecheck + lint + CI green.
