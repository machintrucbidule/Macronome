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
- **14 — AI advisor hook:** named but inert in two places — (a) data: a
  `User.settings.llm_endpoint` config (OpenAI-compatible URL + optional key,
  online or local), stored, unused in v1; (b) API: a reserved route documented
  "not implemented in v1" that, once enabled, receives a curated payload (recent
  intake, macro adherence, weight trend, deficit). No work in v1.

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
