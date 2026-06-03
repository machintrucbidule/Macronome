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
      config artifacts (compose, Caddyfile, Dockerfile, .env.example) are delivered.
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
- [ ] **M2 — Targets & metabolic engine** → `docs/dev-plan/M2-targets-metabolic.md`
      _depends-on: M0._ Pure engine + targets resource; no day dependency yet.
- [ ] **M3 — Daily log (meals, entries, leftover)** → `docs/dev-plan/M3-daily-log.md`
      _depends-on: M1, M2._ The core daily loop; snapshots + proration + verdict.
- [ ] **M4 — Weight & variable periods** → `docs/dev-plan/M4-weight.md`
      _depends-on: M2 (BMR), M3 (logged-day intake for period stats)._
- [ ] **M5 — Recipes & derived food** → `docs/dev-plan/M5-recipes.md`
      _depends-on: M1._ Recipes build a derived Food that M3 can log.
- [ ] **M6 — Stats & adherence** → `docs/dev-plan/M6-stats.md`
      _depends-on: M3 (verdicts/day_kcal)._ Read-only over frozen history.
- [ ] **M7 — Settings & pantry** → `docs/dev-plan/M7-settings-pantry.md`
      _depends-on: M1, M3._ Pantry pins, meal-slot templates, profile, account.
- [ ] **M8 — Migration ETL (late, stable schema)** → `docs/dev-plan/M8-migration.md`
      _depends-on: M1–M7 (schema stable)._ Run against the real workbook; validation
      is **local-only** and re-runnable.
- [ ] **M9 — Polish** → `docs/dev-plan/M9-polish.md`
      _depends-on: M1–M7._ Remaining screen states, i18n completeness, a11y, perf.
- [ ] **M10 — Reserved AI-advisor hook (NOT built)** → `docs/dev-plan/M10-ai-advisor-hook.md`
      _depends-on: M0 (route), M6 (payload shape)._ Inert config + 501 route only.

---

## Status legend

`[ ]` not started · `[~]` in progress · `[x]` done (acceptance green). Keep the
per-milestone files' checklists in sync with the boxes above. When you finish a
milestone, update both, and record any deferred item as a new sub-bullet rather than
silently dropping it.
