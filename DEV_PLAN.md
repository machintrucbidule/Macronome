# DEV_PLAN — living build checklist (index)

The single source of "what's done / what's next". **Claude Code keeps this updated as
it builds.** This file is the index; each milestone has its own file under
`docs/dev-plan/` so no plan file is large enough to lose context (the 300-line rule
applies here too).

The contracts this plan serves are FIXED: logical (`spec/`), visual (`design/`),
decisions (`DECISIONS.md`), architecture (`ARCHITECTURE.md` + `docs/architecture/`).
Implement against them; never edit them to fit the code (`CLAUDE.md` → *Fixed
contracts*).

---

## How Claude Code uses this plan (execution workflow)

A tight loop per milestone — never start one whose dependencies aren't checked off:

1. **Pick** the next unblocked milestone in the order below (top-down; a milestone is
   unblocked when every milestone in its *depends-on* list is fully checked).
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

- [ ] **M0 — Walking skeleton & toolchain** → `docs/dev-plan/M0-foundations.md`
      *depends-on: none.* Scaffold, DB, auth skeleton, one e2e route, all three test
      layers + Prisma↔DDL check + typecheck + lint + pre-commit, Windows dev loop,
      Proxmox deploy + backup/restore drill.
- [ ] **M1 — Foods (catalog + search)** → `docs/dev-plan/M1-foods.md`
      *depends-on: M0.* The first vertical slice; everything loggable starts here.
- [ ] **M2 — Targets & metabolic engine** → `docs/dev-plan/M2-targets-metabolic.md`
      *depends-on: M0.* Pure engine + targets resource; no day dependency yet.
- [ ] **M3 — Daily log (meals, entries, leftover)** → `docs/dev-plan/M3-daily-log.md`
      *depends-on: M1, M2.* The core daily loop; snapshots + proration + verdict.
- [ ] **M4 — Weight & variable periods** → `docs/dev-plan/M4-weight.md`
      *depends-on: M2 (BMR), M3 (logged-day intake for period stats).*
- [ ] **M5 — Recipes & derived food** → `docs/dev-plan/M5-recipes.md`
      *depends-on: M1.* Recipes build a derived Food that M3 can log.
- [ ] **M6 — Stats & adherence** → `docs/dev-plan/M6-stats.md`
      *depends-on: M3 (verdicts/day_kcal).* Read-only over frozen history.
- [ ] **M7 — Settings & pantry** → `docs/dev-plan/M7-settings-pantry.md`
      *depends-on: M1, M3.* Pantry pins, meal-slot templates, profile, account.
- [ ] **M8 — Migration ETL (late, stable schema)** → `docs/dev-plan/M8-migration.md`
      *depends-on: M1–M7 (schema stable).* Run against the real workbook; validation
      is **local-only** and re-runnable.
- [ ] **M9 — Polish** → `docs/dev-plan/M9-polish.md`
      *depends-on: M1–M7.* Remaining screen states, i18n completeness, a11y, perf.
- [ ] **M10 — Reserved AI-advisor hook (NOT built)** → `docs/dev-plan/M10-ai-advisor-hook.md`
      *depends-on: M0 (route), M6 (payload shape).* Inert config + 501 route only.

---

## Status legend

`[ ]` not started · `[~]` in progress · `[x]` done (acceptance green). Keep the
per-milestone files' checklists in sync with the boxes above. When you finish a
milestone, update both, and record any deferred item as a new sub-bullet rather than
silently dropping it.
