# Module map (contract → code)

The explicit mapping an agent uses to locate where a given piece of code belongs.
Three tables: domain logic → backend module; screen → frontend feature; design
component → component file. All paths are relative to the package root.

---

## 1. Domain logic spec → backend module

Each `spec/logic/*` area becomes one **pure** module under `api/src/domain/`. The
worked examples in the spec are wired as unit-test oracles in the matching
`*.test.ts` (see `testing.md`).

| `spec/logic/` file             | `api/src/domain/` module                                | Key functions (illustrative)                                                                           |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `metabolic-engine.md`          | `metabolic/`                                            | `age()`, `bmr()`, `estimatedBurn()`, `empiricalBurnPerDay()`, `deficitPerDay()`, `deficitAtTarget()`   |
| `targets-macros.md`            | `targets/`                                              | `proteinFloorG()`, `fatFloorG()`, `carbCeilingG()` (may be ≤0, never clamped), `suggestRange()`        |
| `day-snapshot-verdict.md`      | `day-verdict/`                                          | `resolveSnapshot(date)`, `dayKcal()`, `autoVerdict()`, `effectiveVerdict()`                            |
| `leftover-proration.md`        | `leftover/`                                             | `netLeftover()`, `validate()` (block rules), `prorate()`, `scaleMacros()`                              |
| `recipes-derived-food.md`      | `recipes/`                                              | `aggregateMacros()`, `per100g()`, `perPortion()`, `hasCycle()` (transitive), `buildDerivedFood()`      |
| `weight-periods-trajectory.md` | `weight/`                                               | `derivePeriods()`, `ema()`, `trajectory()` (broken line), `bmi()`, `projectGoalDate()`                 |
| `stats-adherence.md`           | `stats/`                                                | `rolling(window)`, `okRate()`, `heatmap()`, `monthlyPivot()`, `streak()`, `bestMonth()`, `signals()`   |
| `ciqual-catalog.md`            | `ciqual/` (+ `services/ciqual-seed.ts`)                 | `parseTeneur()`, `buildCatalogEntry()` (keep/derive/drop); the seeder orchestrates, the domain decides |
| `migration-etl.md`             | `packages/etl/src/transform/`                           | nb/poids merge, rating map, summary-day map, weight import                                             |
| `00-conventions.md`            | `shared/src/constants/*` + `domain/search/normalize.ts` | rounding rules applied at display; constants single-sourced                                            |

Rule: a domain function takes **plain inputs and returns plain outputs** (no DB,
no request). Anything needing rows is the **service**'s job (it fetches via a
repository, then calls the domain function).

---

## 2. Screen → frontend feature

Each `specifications/screens/*.md` (+ its mockup) becomes one folder under `web/src/features/`.
The route column matches the masterplan navigation (primary nav + account menu).

| `specifications/screens/` file | Feature folder | Route              | Nav location              |
| ------------------------------ | -------------- | ------------------ | ------------------------- |
| `login.md`                     | `login/`       | `/login`           | pre-auth (own top-bar)    |
| `meals.md`                     | `meals/`       | `/` , `/day/:date` | Repas (primary)           |
| `history.md`                   | `journal/`     | `/journal`         | Journal (primary)         |
| `weight.md`                    | `weight/`      | `/weight`          | Poids (primary)           |
| `food-db.md`                   | `foods/`       | `/foods`           | Aliments (primary)        |
| `recipe.md`                    | `recipes/`     | `/recipes`         | Recettes (primary)        |
| `stats.md`                     | `stats/`       | `/stats`           | Stats (primary)           |
| `targets.md`                   | `targets/`     | `/targets`         | Cibles (account menu)     |
| `containers.md`                | `containers/`  | `/containers`      | Contenants (account menu) |
| `settings.md`                  | `settings/`    | `/settings`        | Paramètres (account menu) |
| `account.md`                   | `account/`     | `/account`         | Compte (account menu)     |
| `about.md`                     | `about/`       | `/about`           | À propos (account menu)   |

A feature folder owns: a page container (route + data fetching), feature-local
`components/`, `hooks/`, optional `modals/`, and `logic/` for **view** logic only
(layout math, keyboard nav) — never domain calculation.

**Route shape (B-266/B-274) — keep both when adding a route.**

1. `app/routes.tsx` holds **lazy component factories** (`lazyNamed(() => import(...), 'Page')`),
   never built elements. The old `['/history', <JournalPage />]` shape instantiated all 20 pages
   at module scope: one ~1 MB chunk, and any `React.lazy` added later would have been inert.
   Heavy leaves that only mount on demand (cook mode, the custom-line/AI dialogs, the Markdown
   renderer) are lazy inside their feature for the same reason.
2. `AppShell` is a **layout route** in `app/router.tsx`, mounted once for the session; pages
   render their **content only** and never wrap themselves in it. Per-screen chrome differences
   (Repas's flush gutter) are derived from the pathname inside the shell, not passed in — a
   layout route takes no per-page props. Remounting the shell used to rebuild the appbar, the
   bottom nav and the animated brand tick on every navigation.

Cross-feature data access goes through `web/src/api/<resource>.ts`, mapping to the
API resources:

| `spec/api/` file                   | `web/src/api/` modules                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `foods-recipes.md`                 | `foods.ts`, `recipes.ts`, `containers.ts`, `loggableSearch.ts`                                    |
| `days-meals-leftover.md`           | `days.ts`, `meals.ts`, `entries.ts`, `leftover.ts`, `journal.ts`                                  |
| `weight-targets-stats-settings.md` | `weight.ts`, `target.ts`, `profile.ts`, `stats.ts`, `settings.ts`, `mealTemplate.ts`, `pantry.ts` |
| `00-conventions.md`                | `client.ts` (fetch wrapper: cookies, CSRF header, error envelope)                                 |
| `system-info.md`                   | `about.ts` (GET /about → the À propos screen)                                                     |

---

## 3. Design component → component file

Each `design/components/*.md` becomes one folder under `web/src/components/`,
consuming **semantic tokens** from `styles/tokens.css` (never raw hex). Theming is
a single `data-theme` attribute on `<html>` (see `design/theming.md`).

| `design/components/` file | `web/src/components/` folder | Notes                                                                                      |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `00-foundations.md`       | `foundations/`               | Surface, FocusRing util, BrandTick, Scrim, Segmented, Pill, IconButton                     |
| `top-nav.md`              | `TopNav/`                    | AppBar, PrimaryNav, AccountMenu, ThemeToggle                                               |
| `buttons.md`              | `Button/`                    | primary / ghost / danger / secondary; SubmitButton (spinner)                               |
| `metric-cards.md`         | `MetricCard/`                | calorie band card + macro floor/ceiling cards; VerdictCluster pieces                       |
| `rating-stars.md`         | `RatingStars/`               | 0–3 stars vs unrated "—" (Gap #7); picker                                                  |
| `badges-verdict.md`       | `VerdictBadge/`              | OK/NOK badge + override menu; Journal pill                                                 |
| `data-tables.md`          | `DataTable/`                 | dense table + line grid + QtyUnitCell                                                      |
| `forms-inputs.md`         | `Form/`                      | Input, NumberInput, Select, Checkbox, Chip, Stepper, SearchField, Autocomplete, InlineEdit |
| `modals.md`               | `Modal/`                     | size scale (sm/md/lg/confirm) + the shared panel shell                                     |
| `toasts-warnings.md`      | `Toast/`                     | block-and-warn, carb-inconsistency, dup-name, failure banner, toast                        |
| `charts.md`               | `Chart/`                     | weight (EMA+trajectory), cartouche, heatmap, bars                                          |
| `states.md`               | `states/`                    | Empty, Skeleton, login error/lockout, Disabled wrappers                                    |

The three **complex modals** are NOT in `components/Modal/` — they are
feature-local because they carry feature logic: `features/meals/modals/LeftoverModal/`,
`features/meals/modals/CustomFoodModal/`, `features/meals/modals/CookModeModal/`.
They _reuse_ the `Modal/` shell and `Form/` primitives. See `modularity.md` for why.

---

## 4. Schema table → repository

| `spec/schema/`             | repositories (`api/src/data/repositories/`)                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `tables-catalog.md`        | `user.repo`, `food.repo`, `food-ref.repo`, `recipe.repo`, `container.repo`                    |
| `tables-logging.md`        | `mealTemplate.repo`, `pantry.repo`, `day.repo` (day_log + meal + meal_entry + leftover_group) |
| `tables-weight-targets.md` | `weight.repo`, `target.repo`                                                                  |
| `indexes.md`               | enforced in `schema.prisma` + migration SQL (GIN trigram, unique constraints)                 |

`day.repo` owns the whole day aggregate (day_log → meal → meal_entry →
leftover_group) because they cascade together and are always read/written as a
unit; splitting them would scatter one transaction across files.

`food-ref.repo` is the one repository whose methods take **no `userId`**: `food_ref`
is global reference data with no owner (`security.md` §6). Its only writer is the
boot seeder (`services/ciqual-seed.ts`).
