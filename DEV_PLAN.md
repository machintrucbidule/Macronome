# DEV_PLAN — living build checklist (index)

The single source of "what's done / what's next". **Claude Code keeps this updated as
it builds.** This file is the index; each milestone has its own file under
`docs/dev-plan/` so no plan file is large enough to lose context (the 300-line rule
applies here too).

The contracts this plan serves are FIXED: logical (`spec/`), visual (`design/`),
decisions (`DECISIONS.md`), architecture (`ARCHITECTURE.md` + `docs/architecture/`).
Implement against them; never edit them to fit the code (`CLAUDE.md` → _Fixed
contracts_).

---

## How Claude Code uses this plan (execution workflow)

A tight loop per milestone — never start one whose dependencies aren't checked off:

1. **Pick** the next unblocked milestone in the order below (top-down; a milestone is
   unblocked when every milestone in its _depends-on_ list is fully checked).
2. **Locate** every file via `docs/architecture/module-map.md` (logic→domain,
   screen→feature, component→file, table→repo) — the milestone file lists them.
3. **Implement** within the modularity rules (`docs/architecture/modularity.md`):
   one responsibility per file, ≤300 lines, logic in the backend, web renders only.
4. **For each calculation**, wire the **neutral** worked example(s) from the relevant
   `spec/logic/*` file as the unit-test oracle(s) **first** (`*.test.ts`), then make
   them pass. Real-value checks go in git-ignored `*.local.test.ts` (never CI).
5. **Run that milestone's acceptance tests** + `npm run typecheck` + `npm run lint`
   (+ `npm run check:schema` if the schema changed).
6. **Check off** the milestone's items here and in its file; note anything deferred.

"Done" for any change = relevant test layer green + schema check (if touched) +
typecheck + lint (`docs/architecture/testing.md` §6). Tick the box only then.

> Vibe-coding safety: each slice is **DB → API → UI with tests in the same
> milestone**, ordered by dependency, smallest blast radius first. If a milestone
> looks too big to implement safely in one pass, split it (add a sub-file here);
> don't let any source file approach 300 lines.

---

## Milestones (in build order)

- [x] **M0 — Walking skeleton & toolchain** → `docs/dev-plan/M0-foundations.md`
      _depends-on: none._ Scaffold, DB, auth skeleton, one e2e route, all three test
      layers + Prisma↔DDL check + typecheck + lint + pre-commit, Windows dev loop
      verified. **Deferred to production setup** (per user decision — local-only this
      session): executing the Docker deploy + the pg_dump/pg_restore drill. The Docker
      config artifacts (image-based `compose.yml`, combined `Dockerfile`, `.env.example`,
      GHCR publish workflow) are delivered. **Deployment model reworked to a prebuilt
      GHCR image — see `docs/architecture/decisions/0001-prebuilt-image-deployment.md`
      (ADR-0001); the old build-from-source compose + Caddyfile are removed.**
- [x] **M1 — Foods (catalog + search)** → `docs/dev-plan/M1-foods.md`
      _depends-on: M0._ The first vertical slice; everything loggable starts here.
      Done: food/food_portion + migration (GIN trigram, CHECKs, FKs in SQL); foods
      CRUD/search API (scoped repo + service + controllers); `normalize()` + rating
      constant (neutral oracles); Aliments screen (sortable table, add/edit modal,
      rating stars, visibility chip/filter, archive). Acceptance green: unit +
      integration (dup-name warning, archive-from-search, tenancy 404, 422) + e2e smoke.
      **Deferred (tracked):** `GET /search/loggable` + `food.recipe_id` FK → M5;
      remaining nav/component variants + locale number formatting + table h-scroll → M9
      (autocomplete dropdown → M3). See `M1-foods.md` and the target files.
- [x] **M2 — Targets & metabolic engine** → `docs/dev-plan/M2-targets-metabolic.md`
      _depends-on: M0._ Done: pure metabolic engine (`domain/metabolic`) + derived-macro
      engine (`domain/targets`) with the neutral oracles; `target` + `weight_entry`
      tables + migration; targets resource (`GET/POST /target`, `POST /target/suggest`)
      with engine readout + non-blocking warnings; `GET/PATCH /profile`; Cibles screen
      (manual targets, derived tiles, suggest dialog, carb-inconsistency banner).
      Acceptance green: metabolic/targets oracles + integration (carb≤0 200+warning &
      save, tenancy isolation, 422) + e2e smoke.
      **Scope change (approved):** `weight_entry` table created **early in M2** (its home
      is M4) so the engine can read the current weight needed for floors/BMR/carb-ceiling.
      A minimal `weight.repo.latestAsOf` is the only read; M4 builds periods/EMA/
      trajectory/Weight-screen on the existing table (see M2 + M4 files).
      **Deferred (tracked):** real recent-avg activity (≈30-day mean) + `empirical_burn`
      wiring → M3 (need `day_log`; M2 ships pure fns + sedentary fallback/null + flags);
      live-while-typing tile recompute + BMI tile + account-menu placement of Cibles → M9.
- [x] **M3 — Daily log (meals, entries, leftover)** → `docs/dev-plan/M3-daily-log.md`
      _depends-on: M1, M2._ The core daily loop; snapshots + proration + verdict.
      **Split into 3 sub-passes (approved, too large for one pass).** **M3a — backend
      DONE:** day aggregate tables + hand-written migration; `domain/{day-verdict,leftover,
serving}` with neutral oracles; days/meals/entries/leftover/journal services + routes + DTOs; integration green (leftover 409s write nothing, tenancy 404, frozen-past
      stability). **M3b — Repas screen DONE:** full `features/meals/` decomposition + shared
      `Autocomplete`/`VerdictBadge`/`CalorieCard`/`MacroCard`; LeftoverModal + CustomFoodModal;
      Repas is the home route; e2e green (entry + leftover apply/block). CookModeModal → M9.
      **M3c — Journal screen DONE:** `features/journal/` (page + header + table + row + comment
      cell), route `/history`, nav after Repas; reuses `VerdictBadge`/`DataTable`/states;
      verdict-pill menu + activity select + inline comment via `PATCH /days/:date`; e2e green
      (calories + OK pill, force NOK, comment persists, day→Repas). See `M3-daily-log.md`
      §"M3b/M3c deviations".
      **Scope changes (tracked):** `container` table added
      early (leftover needs a tare; full Contenants CRUD/screen + "Rien" seeding → M7);
      pantry/meal_slot_template/pin-unpin + template seeding → **M7** (`is_pinned` column
      created but inert — later dropped in B-045, pin derived live; days seed
      `DEFAULT_MEAL_SLOTS`); Cook mode → **M9**. New pure module
      `domain/serving` (ml→g 1:1). `check-schema.mjs` heading parser widened (tooling).
- [x] **M4 — Weight & variable periods** → `docs/dev-plan/M4-weight.md`
      _depends-on: M2 (BMR), M3 (logged-day intake for period stats)._
      **Note:** the `weight_entry` table + migration already exist (created in M2);
      M4 adds the periods/EMA/trajectory/screen on top — no table DDL needed.
      **Split (approved). M4a backend DONE** — `domain/weight` (EMA, trajectory, BMI,
      projection, periods) with neutral oracles; weigh-in CRUD (one-per-day 409
      `weigh_in_date_occupied`+existing_id, date-edit re-derives periods); per-period stats
      reuse `domain/metabolic`; `GET/POST/PATCH/DELETE /weight`; DTOs + `EMA_ALPHA`.
      **M4b Poids screen DONE** — `features/weight/` + shared `components/Chart/` (SVG EMA +
      trajectory, range/waist controls), cartouche, period table, weigh-in modal (date-occupied
      replace + delete), nav tab (Repas · Journal · **Poids** · Aliments · Cibles), FR+EN i18n.
      Acceptance green: weight oracles + integration (409, date-edit re-derive, tenancy 404, 422)
  - e2e (weigh-ins → EMA/trajectory/period; date edit re-derives).
    **Deferred (tracked):** Weight-screen `current_mode` is **ephemeral/client-side** in
    M4; **persistence → M7** (no contract write endpoint today; `app_user.settings` ready,
    no migration). See `M4-weight.md` + `M7-settings-pantry.md`.
- [x] **M5 — Recipes & derived food** → `docs/dev-plan/M5-recipes.md`
      _depends-on: M1._ Done: recipe + recipe_ingredient tables + migration (ref XOR + self-ref
      CHECKs, GIN trigram, `food.recipe_id` FK); `domain/recipes` (aggregate/per100/perPortion +
      buildDerivedFood + transitive `wouldCreateCycle`) with neutral "Sample bake" oracles;
      recipes service (rebuilds the derived food + auto "portion", forward-only + parent cascade) + scoped repo + routes; `GET /search/loggable` (food ∪ recipe-derived) now feeding the Repas
      search; Recettes screen (builder: ingredient block + yield panel + instructions, nav tab,
      FR+EN). Acceptance green: recipe oracles + integration (422 would_create_cycle incl.
      transitive, derived rebuild + "portion", forward cascade with frozen meal_entry, tenancy
      404, loggable) + e2e (build → save → log 1 portion).
      **Deferred (tracked):** builder live-while-typing recompute + client-side transitive
      cycle-disable + daily-log dropdown kcal meta + `/recipes/:id` deep-link routes → M9. See
      `M5-recipes.md` §Deviations.
- [x] **M6 — Stats & adherence** → `docs/dev-plan/M6-stats.md`
      _depends-on: M3 (verdicts/day_kcal)._ Read-only over frozen history. Done:
      `domain/stats` (rolling/heatmap/monthly/streak/best-month/signals) with neutral
      oracles; `day-stat` logged-day mapper + `dayReadRepo.readAll`; stats service +
      `GET /stats/rolling` + `GET /stats/adherence?year=`; Stats screen (rolling cards,
      heatmap, monthly OK/NOK + avg-kcal pivots, key figures, signals, year selector, nav
      tab, FR+EN). Acceptance green: stats oracles + integration (shapes, summary-day
      colour, tenancy isolation, 422/401) + e2e (cards + heatmap render; empty state).
      **Deferred (tracked):** heatmap per-day kcal tooltip (not in the `HeatmapCell`
      contract); full-history read narrowing → M9. See `M6-stats.md` §Deviations.
- [x] **M7 — Settings & pantry** → `docs/dev-plan/M7-settings-pantry.md`
      _depends-on: M1, M3._ Pantry pins, meal-slot templates, profile, account.
      **Split (approved). M7a backend DONE** — meal_slot_template + pantry_item tables +
      migration (`20260605120000_settings_pantry`) + locked built-in "Rien" seeded via
      `user-bootstrap`; settings/meal-template/pantry/containers services + repos + routes +
      DTOs; Repas 📌 `pin`/`unpin`; day scaffold/materialize seed from template + qty-0
      garde-manger prefill (`day-prefill.ts`); `current_mode` persisted on `app_user.settings` + Maintien projection gate moved server-side. **M7b web DONE** —
      `api/{settings,containers,mealTemplate,pantry,auth}`; account-menu dropdown in AppShell
      (Cibles moved off primary nav); `SettingsSync` applies persisted theme+locale on load;
      Paramètres (appearance + meal-template editor + per-meal garde-manger), Contenants
      (table + modal + delete confirm, locked "Rien"), Compte (credentials + password modal +
      logout); FR+EN. Acceptance green: 10 integration cases + e2e (`e2e/settings.spec.ts`
      pin → prefill → unpin future-only) + typecheck + lint + web build + check:schema.
      **Deviations (tracked):** `current_mode` added to the `/settings` DTO (user-approved;
      spec unedited); new error code `pantry_duplicate`; `idx_container_normname_trgm` shipped
      early. See `M7-settings-pantry.md` §Deviations.
- [x] **M8 — First-run & usability** → `docs/dev-plan/M8-first-run.md`
      _depends-on: M0 (auth), M1–M7 (screens to render empty)._ Done: zero-user-gated
      **first-run setup wizard** — `POST /auth/setup` (creates the single owner via the
      reused `seedDefaultsForUser`, opens the session; 409 `setup_already_completed` once an
      owner exists) + non-enumerating `GET /auth/setup-state`; thin `services/setup.ts` +
      `userRepo.count/create`; two-step `features/setup/` wizard (credentials → profile)
      behind a setup-only `AppGate`; **login submission wired** (`useLogin` → session →
      home, generic `invalid_credentials`); `create-user` CLI kept as admin fallback. The
      auth contract amendment was already in place (verified, not re-edited). Acceptance
      green: setup/login integration (empty→200+session+seed, 409, 422, non-enumerating
      probe) + first-run e2e (wizard → logged-in → empty screens → add first food) +
      typecheck + lint + check:schema + web build. _The Excel import is **not** here — the
      personal workbook is loaded through Settings → import (the IMP-1 envelope)._
      **Deferred (tracked):** full unauthenticated route protection (`RequireAuth` →
      `/login`) + login polish (lockout/a11y) + full Empty/Skeleton visual contract → M9.
      e2e isolation via a `first-run` Playwright project the `app` project depends on. See
      `M8-first-run.md` §Deviations.
- [x] **M9 — Polish** → `docs/dev-plan/M9-polish.md`
      _depends-on: M1–M7._ Remaining screen states, i18n completeness, a11y, perf.
      **Split into sub-passes (approved; too large for one pass).** **M9a — States, login &
      i18n DONE:** full login state card (`features/login/` — idle/loading/error/lockout/
      success, live lockout countdown, `stay_signed_in`; `ApiError.retryAfterS`); locale-aware
      numbers via `lib/format/number.ts` (Intl, grouping off → only the decimal mark localises;
      per-feature `format.ts` delegate); Foods load-error banner (Repas already had one); i18n
      key-coverage CI gate (`scripts/check-i18n.mjs` + `check:i18n` step). **No backend change**
      — the login lockout (`rateLimit.ts`/`TRUSTED_PROXY`) was already built + tested. Acceptance
      green: `number.test.ts` + `check:i18n` + typecheck + lint + web build; `e2e/login.spec.ts`.
      **M9b — A11y & layout DONE:** sticky appbar (offset now lines up the dense-table sticky
      `thead`) + `aria-label`/`aria-current` nav; `.tblscroll` long-table variant (Poids period
      table scrolls with a sticky header); global `:focus-visible` ring (`:where()`, zero-
      specificity) + keyboard-operable `SortableTh`; shared `Modal` focus trap (`useFocusTrap.ts`)
  - focus-on-open/restore + `aria-labelledby`; labelled inputs (`Autocomplete` combobox/listbox
    ARIA; `htmlFor`/`id` on Custom/Leftover modals); `RequireAuth`→`/login` guard wrapping every
    app route + a global 401→`/login` handler in `api/client.ts` (skips `/auth/*` + public pages
    so SettingsSync's logged-out probe stays silent). Every app route — including the `/health`
    diagnostic UI — is gated; only `/login`/`/setup` are public (the `/api/v1/health` readiness
    endpoint stays public for Docker/CI but exposes no user data). Acceptance green: typecheck +
    lint + `check:i18n` + web build + unit (65) + full e2e (18, incl. new RequireAuth redirect
    test; the health smoke now logs in). **M9c — Cook mode DONE:** near-fullscreen, keyboard-free
    kitchen-tablet adjustment modal for Repas (`features/meals/modals/CookModeModal/` — frame +
    `CookList`/`CookRow`/`CookNameCell`/`CookUnitCell`/`CookPad`/`NumPad`/`AzKeyboard` +
    `useCookSession` working copy + `useFontAutosize`; pure `logic/{fontAutosize,cookDiff}` with
    oracles); the 🍳 meal-header button is live; edits batch through the existing `updateEntry`
    mutation on Valider (web-only, no backend/schema change). Acceptance green: typecheck + lint +
    `check:i18n` + web build + unit (71) + e2e meals (5, incl. cook qty write-back).
    **M9d — Perf DONE:** on-demand `perf:check` script (seed large synthetic data → measure
    Stats + Foods search → `EXPLAIN` → verify contract indexes → teardown; not a CI gate). Search
    ~5 ms + all indexes confirmed; a measured Stats slowdown (3–5 s over 5 years) fixed by a
    lightweight stats read + trailing-window narrowing for rolling (`day-stat.repo.ts`, no schema
    change) → <0.4 s, all oracles + integration green. **M9 complete.** See `M9-polish.md`.

> **The dev plan ends at M9.** The reserved AI-advisor hook is **not** a build milestone
> — it is an optional, on-demand item (**O2**) below, not a gate for v1.

---

## Status legend

`[ ]` not started · `[~]` in progress · `[x]` done (acceptance green). Keep the
per-milestone files' checklists in sync with the boxes above. When you finish a
milestone, update both, and record any deferred item as a new sub-bullet rather than
silently dropping it.

---

## Out of the dev plan (run on demand — NOT a build milestone)

The development plan ends at **M9**; the app is fully usable from M8 onward (first-run
wizard creates the owner account; no Excel data is required). The items below are **not**
part of the dev plan, carry **no `M` number**, and are **not** gates for v1. They are
documented here only so the information is ready when the author decides to run them.

- **Excel migration (done via in-app import — no build step).** The author's personal
  workbook is migrated through the shipped **Settings → import** feature (the IMP-1 data
  export/import envelope, `spec/api/data-export-import.md`): a ready-to-import extract is
  prepared from the workbook per the **fixed, unchanged** contract `spec/logic/migration-etl.md`
  and loaded once the app is mature, at the author's discretion. It is **not** a first-user
  bootstrap path (that role belongs to M8's first-run wizard). _(Replaces the former
  standalone "O1" ETL plan, now removed.)_
- **O2 — AI assistant (NOT part of the dev plan)** → `docs/dev-plan/O2-ai-advisor-hook.md`.
  Split by B-117 (post-v1 triage):
  - **O2a — Connection config & verification (DONE, B-117).** Paramètres configures an
    **OpenAI-compatible** link (`settings.ai`: base URL + write-only API key + three
    `{model,prompt}` task slots) and **verifies** it by listing the provider's models
    (`GET /settings/ai/models`). Local-only save validation; secret never returned/logged.
    **No AI call is made.** Shipped: shared `settings.ai` DTO + `defaultTaskPrompt` + AI error
    codes; api `domain/ai-connection` (redact/merge) + `services/ai-provider` proxy + redacted
    `/settings`; web active Assistant IA card. Specs: `spec/logic/ai-connection.md`,
    `spec/api/weight-targets-stats-settings.md`, `spec/schema/tables-catalog.md`,
    `design/components/ai-connection.md`, `specifications/screens/settings.md`.
  - **O2b — AI uses (DONE, B-118).** A Repas custom-entry "Analyse par IA" sub-dialog sends 1–4
    photos **and/or** a note to the configured vision model (`POST /ai/dish-photo-macros`) and
    pre-fills the six form fields with one aggregated totals estimate. Shipped: shared `dto/ai.ts`
    - `isVisionModel`; api `domain/ai-dish-photo` (assemble/parse) + `services/ai` + provider
      `chatCompletion` (transient retry, provider-message passthrough, `ai_rate_limited`/`ai_unavailable`);
      web `AiDishAnalysisDialog`. Specs: `spec/logic/ai-dish-photo-macros.md`, `spec/api/ai.md`,
      `design/components/ai-dish-analysis.md`. The `meal_suggestions` / `advice` task endpoints and the
      generic `POST /advisor/query` (**501 `not_implemented`**) remain reserved.
      See `DECISIONS.md` Gap 14 / B-117 / B-118.
  - **O2c — AI meal-proposals (IN PROGRESS, B-123).** The `meal_suggestions` task: a Repas
    `✨ Proposition IA` popup proposes **3 distinct food sets** (foods + quantities) that bring the
    **whole day** into its calorie band + macro floors/ceiling, via the **hybrid** (LLM chef picks
    foods → pure deterministic solver sets quantities → code verifies the day total; the fit is never
    trusted from the LLM). Apply writes plain entries through `POST /meals/:id/entries`; refine
    ("I don't have X", "fix this qty") recomputes. Specs: `spec/api/ai.md`,
    `spec/logic/ai-meal-suggestions.md`, `spec/logic/meal-solver.md`, `spec/schema/tables-catalog.md`
    (`food.ai_proposable`). Built across 13 slices
    (`specifications/features/ai-meal-proposals/dev-plan.md`):
    - [x] **S1 — Contracts + shared types** (this batch): apply the spec amendments to the live
          contracts; add the meal-suggestions DTOs (`dto/ai.ts`), the new default prompt, and the solver
          tuning constants. No runtime behaviour. _(The `dto/food.ts` `ai_proposable` field is deferred
          to S2, where its producer — the column/repo/serialiser — lands, so S1 stays purely additive.)_
    - [x] **S2 — `food.ai_proposable` column** + migration + repo round-trip + the `dto/food.ts`
          field (read required; create `.optional().default(true)`; update optional). New foods default
          ON; the visible toggle is S3. Integration: default-true on create, false round-trip, DB-default
          backfill.
    - [ ] S3 Foods-form "Dispo IA" toggle (web, end-to-end for the toggle).
    - [ ] S4 Solver foundation — remaining + types + penalty + verify (pure).
    - [ ] S5 Solver search — `solve.ts` (pure) + determinism.
    - [ ] S6 Chef domain — assemble + format + parse (LLM-shaped, mocked).
    - [ ] S7 Repos — candidate pool + OK-day history sampling.
    - [ ] S8 Service + controller + route (API end-to-end, LLM mocked).
    - [ ] S9 Web client + hook + button + request popup.
    - [ ] S10 Web proposals display.
    - [ ] S11 Web refine panel.
    - [ ] S12 Web apply a proposal + apply-mapping.
    - [ ] S13 i18n completeness + docs + full gate.
          See `DECISIONS.md` B-123.
