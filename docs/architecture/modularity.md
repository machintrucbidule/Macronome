# Modularity & file-size discipline

A **hard project requirement**, not a style preference. Large files are the single
biggest cause of an AI agent losing context, editing the wrong region, or silently
dropping code on a rewrite. These rules keep every file small, single-purpose, and
locatable.

---

## 1. Hard rules

1. **Max 300 lines per source file** (`.ts`, `.tsx`). Lint **errors** above 300.
   Warns at 250 — treat a warning as "split before adding more".
2. **One responsibility per file.** A file exports one component, or one hook, or
   one domain function group, or one service, or one repository — not a grab-bag.
3. **Max ~80 lines per function** (lint warning). A longer function is extracted.
4. **No barrel file does work.** `index.ts` only re-exports; it never contains logic.
5. **Co-locate the test.** A domain module ships its `*.test.ts` beside it.

Exemptions (not counted by the rule): `prisma/schema.prisma`, generated Prisma
client, `i18n/locales/*.json`, `styles/tokens.css` (verbatim from the contract),
Prisma migration SQL, lockfiles. The lint config lists these explicitly.

---

## 2. The split rules (how a thing becomes several files)

The monolithic mockups must NOT be transcribed as one big component. Concretely:

**A mockup HTML file → three concerns, separate files.**
- markup/structure → the React component (`.tsx`),
- styling → semantic tokens via CSS module / styled rules (`.module.css` or
  co-located styles); **never** inline raw hex — only `var(--token)`,
- behaviour → hooks / view-logic (`.ts`).

**A complex modal → its own folder, never inline in a page.** The three flagged in
`design/components/modals.md`:
- `LeftoverModal/` — selection list, gross/tare inputs, net readout, live preview,
  block-and-warn. Split: `LeftoverModal.tsx` (shell) · `LineSelector.tsx` ·
  `PreviewList.tsx` · `useLeftoverPreview.ts` (calls the API; **no** local proration
  maths — the server computes; the client shows the previewed result).
- `CustomFoodModal/` — `CustomFoodModal.tsx` · `useCustomEntry.ts`.
- `CookModeModal/` — the full-screen takeover: `CookModeModal.tsx` (frame) ·
  `CookRow.tsx` · `NumPad.tsx` · `AzKeyboard.tsx` · `useCookSession.ts` (working-copy
  state) · `useFontAutosize.ts`. Each easily under 300 lines; together they replace
  the largest mockup region.

**A large screen → page container + sub-components.** Example: `features/meals/`

```
features/meals/
├─ MealsPage.tsx              # route container: fetch day, layout zones, wire modals
├─ components/
│  ├─ DayHeader/
│  │  ├─ DayHeader.tsx
│  │  ├─ DateNavigator.tsx
│  │  ├─ CalendarPopover.tsx
│  │  └─ DayTypeTag.tsx
│  ├─ TotalsRow/
│  │  ├─ TotalsRow.tsx
│  │  └─ VerdictCluster.tsx   # DayActivitySelect + OKNOKBadge menu + Constat
│  ├─ MealColumn/
│  │  ├─ MealColumn.tsx
│  │  ├─ MealHeader.tsx       # name + MealMenu
│  │  ├─ LineHeader.tsx
│  │  └─ MealFooter.tsx       # LeftoverButton + totals
│  ├─ FoodLine/
│  │  ├─ FoodLine.tsx
│  │  ├─ QtyCell.tsx          # number input + unit chip
│  │  ├─ UnitMenu.tsx
│  │  └─ PinToggle.tsx
│  └─ InlineFoodSearch/
│     └─ InlineFoodSearch.tsx # reuses components/Form/Autocomplete
├─ modals/                    # LeftoverModal/ CustomFoodModal/ CookModeModal/
├─ hooks/
│  ├─ useDay.ts               # data + mutations (query client)
│  └─ useMealKeyboardNav.ts   # serpentine Tab + arrow caret-edge nav
└─ logic/
   └─ columnFit.ts            # n = round(w/400), colWidth = floor(w/n)  (VIEW math only)
```

Every box above is one file under the cap. None of them holds a domain
calculation — burns, verdicts, proration, totals all come from the API.

---

## 3. Where logic is NOT allowed to leak

- **Frontend `logic/` is view-only** (layout fit, keyboard caret rules, font
  autosize). Calorie totals, OK/NOK, proration, EMA, BMI, etc. are server-computed
  and only displayed. If a `web/` file imports an energy/activity constant to
  *compute* a nutrition figure, that is a bug — it should call the API.
  (`shared` constants are imported by `web` only for **labels/formatting**, e.g.
  showing the activity multiplier next to its name.)
- **Controllers stay thin** (parse → service → serialize). A controller doing maths
  or SQL is a split signal.
- **Repositories hold no business rules** — only scoped CRUD/queries.

---

## 4. Enforcement

Convention is not enough; the rules are machine-checked.

- **ESLint** (flat config, `eslint.config.js`):
  - `max-lines: ["error", { max: 300, skipBlankLines: true, skipComments: true }]`
  - `max-lines-per-function: ["warn", { max: 80, skipBlankLines: true }]`
  - `complexity: ["warn", 12]`
  - import boundaries (via `eslint-plugin-import` / `no-restricted-imports`):
    `web/**` may not import `api/**`; `domain/**` may not import `data/**` or
    `http/**`; `controllers/**` may not import Prisma directly.
  - the exemption globs listed in §1.
- **TypeScript** strict mode everywhere (`tsconfig.base.json`).
- **Pre-commit** (lint-staged + a lightweight hook) runs eslint + prettier +
  `tsc --noEmit` on changed files, so an oversized or boundary-violating file is
  rejected before commit.
- **CI** re-runs lint + typecheck + tests on push.

The exact config text is in `appendices/config-lint.md`. The agent's standard
workflow (`CLAUDE.md`) ends every change with lint + typecheck + the relevant
tests, so the size rule is hit immediately, not at review.
