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
  re-added (pin = boolean per (meal_slot_name, food_id)); (c) removing a food
  here = unpinning = affects **future-day pre-fill only**; today's and past days'
  already-created lines are untouched (a day's lines are independent once the day
  exists). Same operation as toggling 📌 off on Repas, seen from the other side.
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
  and is traced in `docs/dev-plan/O1-excel-migration.md`. Its logic contract
  `spec/logic/migration-etl.md` is **unchanged**. The ETL is **no longer** a first-user
  bootstrap path (that role is now M8's wizard). _(Author.)_

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
