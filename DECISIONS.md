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
