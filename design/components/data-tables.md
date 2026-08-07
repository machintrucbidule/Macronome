# Dense data tables & grids

Macronome is spreadsheet-replacement-dense. Two shapes: (1) **HTML tables**
(Aliments, Recettes list, Journal, Poids periods, Contenants) and (2) **CSS-grid
line lists** (Repas meal columns, Recipe ingredient builder).

## Shared table conventions

- `table{width:100%; border-collapse:collapse; font-size:var(--fs-13)}`.
- **thead th**: `--font-num; --fs-10; uppercase; ls .04em; color:var(--text-faint);
font-weight:400; padding:9px 10px; border-bottom:1px solid var(--border)`
  (Aliments/Recettes use `--border-strong`). Numeric headers right/centre-aligned
  (`.r`/`.c`). **Sticky** headers stick at `top:51px` (= `--appbar-h`) with
  `background:var(--bg)`, `z-index:var(--z-sticky-sub)` — i.e. **below** the appbar
  (`--z-appbar`), so the account menu (in the appbar's stacking context) overlays the
  header rather than the header painting over it (B-069, see `DECISIONS.md`).
- **tbody td**: `padding:7–9px 10px; border-bottom:1px solid var(--border)` (or
  `color-mix(--border 50%)` for lighter inner rows). Numeric cells `--font-num;
tabular-nums; white-space:nowrap`; first/name cell left, `--font-body`. The **Journal**
  table opts into a denser row (`padding-top/bottom:4px`) as a scan-heavy day list (B-065,
  see `DECISIONS.md`); other tables keep the 7–9px default.
- **row hover**: `background:var(--bg-elev-2)` (or `color-mix(--bg-elev-2 70%)`).
- **clickable row**: `cursor:pointer` + `title`.
- **sortable header**: `cursor:pointer; user-select:none`; hover `color:var(--text)`;
  sorted state `.sorted` shows the arrow (`.arr`) in `--accent`; arrow flips ▼/▲.
  (Aliments: Nom·kcal·L·G·P·Note·Source·Visib·Util. sortable; **Portion not sortable** —
  DECISIONS Gap #10.)
  **First-click direction (B-299)** — one rule for every table: a column carrying a **number or a
  date** starts **descending** (the useful direction: most calories, best note, most-used, most
  recent); a **text** column starts **alphabetical**. Re-clicking the active column toggles, and
  the **default sort on load is unchanged** (Aliments Nom A→Z, Historique Jour desc, Utilisateurs
  Créé le). The mobile Trier sheet routes through the same state, so it obeys the same rule.
- **scroll container**: a contained-scroll variant (`max-height` + its own `overflow`, header
  pinned to the box top rather than the appbar) is **not implemented** (B-273): the two long
  tables have divergent sticky-header needs — Poids viewport-anchored, Utilisateurs contained —
  so a single shared variant cannot serve both and any future case stays **screen-local**.
  **No screen uses one by default** — the Poids period table renders in
  normal page flow with the standard appbar-sticky header (B-189); when the 15-column table
  is wider than a narrow desktop window, the **page** scrolls sideways (a contained
  horizontal scroll and an appbar-sticky header can't coexist in one wrapper).
- **column sizing (any paginated / progressively-rendered table)**: lay out on **declared
  widths, not on rendered content**. `table-layout: fixed`; **one declared width per column**,
  sized to that column's real maximum — which for most columns is the uppercase `--fs-10`
  **header** (it is `nowrap`), not the value; **exactly one** column left undeclared, the
  name/free-text one, so a fixed layout gives it the remainder; `white-space: nowrap` on
  `tbody td` so every row keeps the same height (the scroll reserve measures the pitch of the
  rows already drawn); and `overflow:hidden; text-overflow:ellipsis` + the full value on
  `title` for the elastic column and any other free-text cell.
  Under the default `auto`
  layout a column is as wide as the widest row **currently rendered**, so each arriving page
  re-solves the whole table and the columns — and the sticky header cells above them — visibly
  jump. **Screen-local, never in `DataTable.module.css`**: the shared sheet serves tables with
  different column counts. Applies to **Journal** (B-276, where the rule was first worked out),
  **Aliments** and **Recettes** (B-284); **Utilisateurs, Contenants and Poids stay on `auto`**
  — short, unpaginated lists (owner scope). Guarded per screen by a source-level test
  (`*-columns.test.ts`), since jsdom cannot catch a layout regression. Accepted consequence:
  declared columns cannot squeeze, so on a narrow desktop window the table overflows and the
  **page scrolls sideways** — the same behaviour as the Poids period table above.
  **`overflow-anchor: none` on the rows container** (LD-1/B-303): a backfilled page lands _above_
  the viewport, and the browser's scroll anchoring compensates for the gap it replaces by pulling
  the scroll up by exactly that page — measured at thirteen steps of 2 385 px on the Ciqual
  catalog, while the document height never moved. These lists compute their own reserved height,
  so the compensation only ever fights them. Scoped to them: a list that only appends below (the
  Journal) is unaffected and keeps the browser default.
  **Where a row can carry an optional extra line** — only Aliments, the comment sub-line — the
  reserve is **computed, not averaged**: the row marks itself `data-row-tall`, the two heights are
  measured separately, and the server reports how many of the matching rows carry it
  (`with_comment`), so what is reserved is the exact height of what is missing. A variance that
  **cannot** be counted server-side (a value line free to wrap at some viewport width) is not
  allowed at all — it is kept to one line, like every other cell.
- **narrow desktop bands (Aliments)** — two, because the columns do not all cost the same:
  - **below 960px**: Source steps aside (B-291). It is the widest chip column (`CHRONODRIVE`
    sets its width), and the table is already at the edge of its budget just above 820px —
    without its own band, adding it would have pushed the elastic Nom column to a negative
    width between 821 and ~900px, i.e. a table overflowing its page.
  - **below 820px**: Portion and Visibilité step aside too, and the second comment line under
    the name is dropped.
    Hidden **by column index, header and cell together** — hiding the cell class alone slides the
    whole body one column left (B-284). A band that hides a column must therefore be re-checked
    against the declared-width budget whenever a column is added: the arithmetic, not the eye,
    decides where a band goes.
- **second Aliments table instance — the Ciqual catalog (B-292)**: the screen's `Catalogue Ciqual`
  mode renders its own table under the same column-sizing rule, in its own CSS module and behind
  its own source guard (`catalog-columns.test.ts`). Six columns — Nom (the one undeclared, elastic,
  carrying the food group on the comment sub-line), kcal, L, G, P, add — total 17.75rem of declared
  width, so it needs **no narrow band at all**: the arithmetic that forced two bands on the Aliments
  table leaves this one comfortable at every width. Add a column here and redo that arithmetic.
- **page mode switch (Aliments, B-292)**: when a screen has two list modes, the switch is an
  `aria-pressed` segmented control on **its own band under the toolbar**, identical desktop and
  mobile. Not inside the toolbar: that is a single flex row already carrying the title, the count,
  the search field, the filters and the primary action, and on mobile it is sticky and tighter
  still. A primary action that means nothing in the other mode is **disabled, never removed**, so
  the toolbar keeps its geometry across a switch (owner).
- **archived row**: `opacity:.45`; name suffixed `· archivé` via `::after`
  (`--font-num; --fs-10; --text-faint`).
- **row icon actions**: hidden until hover (see foundations icon buttons);
  archive 🗑 / restore ↺ / delete ×; destructive hover → `--nok`.

## Macro cells (Journal)

`.mF→var(--c-fat)`, `.mC→var(--c-carb)`, `.mP→var(--c-prot)`; `.none →
var(--text-faint)` em-dash when a day has no macro detail. The three L·G·P values render as
**fixed-width, right-aligned, tabular-nums slots** inside the single Macros cell so they
**column-align across rows** (B-135), keeping the L·G·P order and per-macro colours.

**Macro values colour-coded — Aliments & Recettes too (B-175).** The same per-macro tinting
(`--c-fat`/`--c-carb`/`--c-prot`) applies to the per-row **L/G/P value cells** of the **Aliments**
and **Recettes** desktop tables (kcal stays neutral), matching the meal tables + Journal cells.
The Recettes mobile card already tints; this extends it to the desktop tables. No new token.

## Day-state band + legend (Journal, JR-1 / B-077)

Each Journal row carries a **left colour band** keyed to its calorie-driven state
(`logic/day-snapshot-verdict.md §8`): a `box-shadow: inset 3px 0 0 var(--state)` on the
**first cell** — **green** `--ok` (Complet), **yellow** `--accent` (Partiel), **red** `--nok`
(Rien). The **red** row also keeps a soft full-row `background:var(--nok-soft)` (empty-day
emphasis); green/yellow are **band-only** (no full-row tint) so the dense list stays scannable.
`none` (future empty) shows no band. **No new token** — the Partiel yellow reuses `--accent`
(the calendar partial-dot colour, established in DK-1).

A small **state legend** sits in the header to the right of the year selector, reusing the
`ChartLegend` swatch pattern (`legend`/`legendItem`): three items **Complet · Partiel · Rien**,
each a small square swatch in the matching state colour. `--font-num; --fs-11; --text-dim`.

## Verdict-cell kcal écart (Journal, B-138)

The Verdict cell holds the OK/NOK badge **plus** a signed kcal écart **vs the upper target**
(`kcal − cal_max`, server-provided `kcal_gap`). The cell is a `flex` row; the badge sits in a
**fixed-width slot** (`.badgeSlot`, `min-width:7rem`) so the écart lands **just to its right** with
only a light `--sp-3` margin while the figures still **line up down the column** (`--font-num;
tabular-nums; --fs-12`) — it is **not** pushed to the far column edge. Colour: at/under `cal_max`
→ **green** `--ok` (negative écart, incl. an in-band OK day); over `cal_max` → **red** `--nok`
(positive). It is **always shown** on a logged (green/yellow) day; rendered only when `kcal_gap`
is non-null (red/empty days omit it). On **mobile** cards the écart sits to the **left** of the
static verdict pill (`--fs-11`, same green/red rule, no alignment requirement).

The **badge/pill itself** follows the NOK deficit sub-tone (B-166, `badges-verdict.md`): a NOK
verdict is **orange** (`--warn`) when the day is in a deficit (`burn_gap ≤ 0`), **red** otherwise or
when the burn is unknown; OK stays green. This is independent of the kcal écart above, which keeps
its own green/red sign rule.

## Activity-cell expenditure écart (Journal, B-163)

A **twin** of the verdict-cell écart, in the **Activité** column: the cell holds the activity
selector **plus** a signed kcal écart **vs the day's estimated expenditure** (`kcal −
estimated_burn`, server-provided `burn_gap`). Same construction as B-138: the cell is a `flex`
row, the selector sits in a **fixed-width slot** (`.activitySlot`) so the écart lands **just to its
right** with a light `--sp-3` margin and the figures **line up down the column** (`--font-num;
tabular-nums; --fs-12`). Colour: intake **under** the burn (negative écart, a deficit) → **green**
`--ok`; over → **red** `--nok` — reuses the `.gap`/`.gapUnder`/`.gapOver` rules. Rendered only when
`burn_gap` is non-null (a logged day with a weigh-in; otherwise omitted). On **mobile** cards the
écart is **right-aligned on the activity line** (`--fs-11`, same green/red rule). On **desktop**
(B-165) the selector itself carries a **uniform fixed width** (`.act`, `7rem`) and the verdict badge
likewise (`.badge`, `99.12px` — the measured natural "NOK Auto" width; the `.badgeSlot` matches it) — so the controls line up down each column
and the écarts align perfectly; mobile keeps the content widths.

On **desktop**, both écarts (verdict-cell target écart and activity-cell expenditure écart) carry a
**hover tooltip** (B-164) spelling out the figure — "{{n}} calories en dessous/au-dessus de la cible"
and "… de la dépense estimée". It uses the shared hover **Tooltip** primitive (`tooltip.md`), not the
native `title`; **no tooltip on mobile** cards.

## Target history table (Cibles, TH-1 / B-091)

The "Historique des cibles" panel reuses the **shared table conventions** above (no
sortable headers needed — few rows): columns **Depuis · Jusqu'au · Calories · Prot/Lip ·**
a hover-revealed delete (×, `--nok`). Numeric columns right-aligned (`.num`). The row
**loaded into the editor** carries an `--accent`-tinted background
(`color-mix(--accent 12%)`), distinct from the plain hover fill. **No new token.**

## Period-table colour coding (Poids, WV-1 / B-115)

The Poids recap (Period) table layers **server-fact-driven** colour/iconography on the
existing numeric cells (figures already on the `Period` DTO; the web only picks a class).
Reuses existing tokens — **no new token**.

- **Trend tone** (Δ, écart-trajectoire, déficit/j): a `.pos`/`.neg` colour class on the
  numeric cell — `.pos → var(--delta-pos)` (green), `.neg → var(--delta-neg)` (red), no
  class when the value is 0 or null. "Good" = the **lower** value: weight ↓, **below**
  the trajectory (negative écart = ahead of plan), and a calorie **deficit** (negative
  `deficit_per_day`); déficit/j is coloured by sign **in both régime and Maintien**. The
  **Δ** cell also prepends a small arrow span (`--fs-10`): **▼** when losing, **▲** when
  gaining (none at 0).
- **Activity pill** (activité moyenne): the `avg_activity` PAL multiplier is bucketed to
  the nearest of the five levels and shown in an inline `.actTint` pill — soft background
  `color-mix(--act-color 16%, transparent)` + inset border `color-mix(--act-color 45%,
transparent)`, where `--act-color` is set per level by the **same B-085/B-101 palette
  (revised B-152)** as `ActivitySelect` (Sédentaire `--nok` → Léger `--accent` → Modéré
  `--ok` → Intense `--blue` → Très intense `--violet`). null → plain em
  dash, untinted.
- **Régime badge** (régime): a pill with **two distinct neutral tints** (no good/bad
  sense) — `.flagDiet` (En régime) = accent soft bg + accent border; `.flagMaint`
  (Maintien) = `--bg-elev-2` bg + `--text-dim` text + `--border`.
- **Interval-days button** (Poids, B-225): a narrow non-numeric column inserted **between
  période and durée**, holding a small **icon button** (📋, `--fs-12`, muted `--text-dim`,
  brightening on hover) with an **empty column header** and an accessible label « Voir les
  jours de l'intervalle ». Clicking it opens the read-only interval-days recap popup
  (`modals.md §Interval-days recap`); the button `stopPropagation`s so it never triggers the
  row's edit-on-click. Present on every row incl. the open-interval lead row. **No new token.**

### Open-interval lead row (Poids, B-176)

When the server emits `open_period` (`logic/weight-periods-trajectory.md §2.1`), the Period
table (desktop) and the mobile period list render it as a **lead row at the top** (before the
newest closed period), marking the span from the last weigh-in to today:

- **Période** cell reads `<last weigh-in date> → Aujourd'hui` (the end is the live word, not a
  date). The row is **clickable** like any period row, but opens the **reduced "open period"
  modal** (`modals.md`), not a weigh-in.
- **Computable cells** render normally: durée, apport moyen, dépense estimée, déficit/j
  (same trend tone as closed rows), activité moyenne (same pill), régime badge
  (= `current_mode`), note.
- **End-weight-dependent cells dash** (em dash, the existing `orDash`/`DASH` treatment): Poids,
  Tendance, Δ, Écart traj., IMC, Taille, Dépense empirique.
- **No new token, no new colour.** Distinct emphasis of the lead row itself is handled by the
  `:first-child` background rule (B-178); on its own the open row is a normal period row with
  dashed end-weight cells.

### First-row emphasis (Poids, B-178)

The **first** (most recent) row of the period table — whether a real most-recent period or the
B-176 open-interval lead row — carries a **distinct background** (`--bg-elev-2`, the same neutral
emphasis as the Maintien badge), marking it as the most recent / most important. Implemented as a
pure-CSS `:first-child` background on both the desktop `.periodRow` and the mobile list `.row`, so
it is **order-independent of B-176** (it auto-covers the open row once that leads the table). The
desktop row hover (`--bg-elev`) still takes over on hover per the existing cascade. No new token.

## Line-list grid (Repas meal column) — instance A

A meal `.meal` is a flex column on `--bg-elev`, `min-height:200px`. The **whole-table
container** (the columns scroller) draws a **continuous outer border on all four sides with
`--r-lg` on all four corners**; the columns themselves provide only the inter-column dividers
(`border-right`), not the outer frame (B-201). (On the ≤760px stacked layout each column is
instead an individual full-bordered `--r-lg` card.) Header `.meal-head` (name in `--font-display
--fw-bold --fs-14` + **cook** + **copy-yesterday 📋‹** + ⋯ menu).

**Cook-mode button (ICON-1 / B-281 / B-283).** Comes **first of the two**, immediately after the
name: cook mode is the frequently-used control of the pair and leads (this revises CP-2/B-248,
which put copy first). Its icon is a **numeric-keypad glyph drawn as an inline outline `<svg>`**
(18px, `fill:none; stroke:currentColor`), **not** an emoji — the mode opens a large touch NumPad
(`modals.md`), so the keypad is the honest metaphor, and an emoji at `--fs-14` renders differently
on every machine. Same precedent and rationale as the Conseils lightbulb (`top-nav.md`): inlined at
the call site, tinted via `currentColor`. It is **tinted `--accent` at rest** — deliberately the
findable one of the two — so its hover changes the **border only** (`--accent`), the resting colour
already being the accent.

**Copy-yesterday button (CP-2 / B-248, re-ordered and re-toned by ICON-1).** Sits **immediately
right of the cook button** and shares its exact box (`1px solid var(--border)`, `--bg-elev-2`,
`--text-dim`, `--r-sm`, `--fs-14`, `padding:5px 8px`, hover → `--accent` border + text). The 📋
glyph carries a small **« ‹ »** badge on its top-right corner, sharing the mobile 📷 button's badge
**geometry** (anchored to the icon, not the button: `position:absolute; top:-6px; right:-6px; 12px`
pill, `font-size:10px`) but **not its colours**: the copy badge is **neutral** (`--text-dim` fill,
`--bg-elev-2` glyph) because copying yesterday is a rare action that must not draw the eye, while
the **photo badge keeps `--accent`/`--accent-ink`** — accent-on-camera is the primary affordance of
the mobile header. **The two are separate colour rules on purpose; do not merge them back.**
Tooltip + `aria-label` "Copier le repas de la veille". **Hidden ≤560px** by the same rule that hides
the cook button; the action moves into the meal ⋯ sheet as a text row.

Lines via CSS grid:
`grid-template-columns: 7px 1fr 57px 28px 21px 21px 21px 15px 15px` with **`gap: 3px`**
(grip · name · qty+unit · kcal · L · G · P · pin · del). **Every fixed track is sized to its
own content at maximum, not to a round number** (GR-1 / B-252): kcal holds 4 monospace digits
(27.6px in 28), each macro 3 digits (20.7px in 21), and qty+unit holds the 36px input + 2px
inner gap + the **18px** unit chip (`g`/`ml`/`kg`/`nb`) — the chip was previously squeezed to
16px and ellipsised "nb" into "n…". Everything left over goes to the `1fr` name column
(longer food names show before ellipsis); the incompressible width is **217px**
(tracks 185 + 8 gutters 24 + **side padding 8**). Side padding is **`0 3px 0 5px`** (B-288):
the meal column is the densest surface in the app and 20px of it was going to empty gutters;
the left keeps 5px because `.used` paints its 2px accent **inside** the padding box. The 12px
reclaimed goes **entirely to the name column** — `MIN_VIABLE_COL_WIDTH` deliberately stays
**275px** (`logic/columnFit.ts`), so the number of meal columns at a given window width is
unchanged and the guaranteed name allowance grows 46 → 58px. The padding is declared once on
the shared row, but the **footer total re-declares it** (`.totalRow`) and must be kept in step
or the totals stop lining up with the columns above. The value cells deliberately carry **no
`overflow: hidden`**, so a sub-pixel overrun spills into the gutter rather than truncating.
`.lhead` row `--fs-9`
uppercase. Line `min-height:28px`. Footer `.meal-foot` = totals on `--bg-elev-2`.
Line states: `.empty` (italic faint "+ aliment"), `.zero` (**whole-line muted**:
text cells name/qty/unit/macros in `--text-faint`, grip/📌/× at `opacity:.45` — a
quantity-0 line, e.g. a garde-manger placeholder, reads as inactive; reverts to normal
the instant qty > 0; B-107), `.used`
(`box-shadow: inset 2px 0 0 var(--accent)`; **renamed from `.pinned` and re-keyed on quantity > 0
rather than on pin state by B-224** — the accent marks a line that is actually used, and the pin
keeps its own 📌 glyph), `.editing`
(`background:var(--bg-field)`, inline search input), `.dragging` (`opacity:.4`),
`.selected` (**B-207 desktop selection-sum** — a full-row `--select` **blue** background tint,
**no checkbox and no extra column**; deliberately distinct from `.used`'s amber left edge, so a
line that is both used **and** selected shows both — the blue fill + the amber edge).
Hover reveals pin/del. The **drag grip is permanently visible** on any row that holds a food —
faint at rest, full opacity on hover (B-298); the blank spacer grips of the empty "+ aliment" row
and of the inline-editing row stay invisible, which is what makes the handle read as "this row can
be reordered". A meal keeps ≥2 trailing empty lines, ≥15 lines min.

**Macro values colour-coded.** The per-line **L/G/P** macros **and** the meal-total
L/G/P are tinted with the macro tokens (`--c-fat`/`--c-carb`/`--c-prot`), matching the
totals dots, **at every width** (owner-approved desktop change, 2026-06-11). `kcal` keeps
its colour; `.zero` lines stay muted (the tint is gated on `:not(.zero)`).

### Selection sum (desktop controls bar, B-207)

An Excel-status-bar-style live SUM of a chosen subset of meal food-lines — **desktop only** (the
controls row is `display:none` ≤560px, so no mobile surface). A **Σ toggle** in the controls-row
right action group (with Tout copier hier / Tout effacer / + Repas) enters **selection mode**; it carries
a **distinct active/pressed state** (accent-filled fill + `--accent-ink`, `aria-pressed=true`) so the
mode is obvious. In selection mode a **click on a line body** toggles that line's `.selected` state,
and a **click on a meal footer** toggles the whole meal (= all its eligible lines); **Ctrl/⌘-click**
enters the mode and selects; leaving the mode (Σ off) clears the selection. The pin/delete/qty/name
controls keep their own actions (they stop the row-click). Eligible lines = filled entry rows only
(`[data-line-row]`), excluding empty rows and greyed qty-0 pantry scaffolds.

The **sum readout** shows **centered** in the controls bar (in the `.ctrlSpacer`, between Proposition
IA and the undo/redo group), only while selection mode is on. Its **order and styling mirror the meal
lines / footer**: `Σ · <g> g · <kcal> kcal · L <fat> · G <carb> · P <protein>` in `--font-num` at
`--fs-15`, with **kcal in bold** and the **L/G/P figures colour-coded** (`--c-fat`/`--c-carb`/
`--c-prot`), each rounded per `00-conventions` (kcal + aggregate macro grams = integer, half-up). The sum is a **client-side ephemeral display aggregate** — a pure
addition of the per-line `consumed` values the rows already hold; non-persisted, never authoritative
(see `DECISIONS.md` B-207). A **selected meal footer** is highlighted the same blue `.selected` way
over its `--bg-elev-2` background; its total figures are unchanged (only its selectable state is new).

### Mobile (≤560px) — meal tabs, two-row line, sheets (mobile-responsive S4 + S9)

On phones the dense column scroller becomes a **tab layer** and the inline interactions move
to overlays; desktop (≥561px) is unchanged.

- **Meal tab bar** (S4): a full-width band pinned above the bottom nav — one segment per meal,
  two lines (name + kcal), active in `--accent`, horizontal scroll on overflow. **One meal
  visible** at a time (all columns stay mounted; CSS reveals the active one). A **horizontal
  swipe** on the meal area switches meal (S9); day navigation stays arrows + calendar.
- **Two-row food line** (S4): row 1 = grip · name · quantity; row 2 = the macro cluster (kcal
  bold + L/G/P colour-coded + `L·G·P` legend). The pin/× icons are **not** on the line.
- **Tap routing** (S9): tap **name** → **bottom-sheet** food picker (search-only); tap **quantity**
  → inline numeric edit; tap **elsewhere on the line** → bottom-sheet **line editor** (change
  food · quantity + unit · move to meal (B-188) · pin · delete). Works on garde-manger scaffold
  pre-fill lines too (pinned, qty 0): they resolve by row, and the sheet offers change-food +
  quantity (no move/pin/delete until materialised). **Long-press the grip** → touch
  drag-to-reorder.
- **Meal “⋯” menu** (S9): a bottom sheet — **Copier le repas de la veille** · **Supprimer tous les
  aliments** · **Tout remettre à zéro** · move left/right · rename · delete (MC-1/B-296; the copy
  stays first, the two bulk actions follow it, and rename joins delete at the bottom). The cook button is **removed on mobile**, and the header's
  📋‹ copy button likewise moves into this sheet as its first text row (CP-2 / B-248); the
  **⊟ Restes button stays in the meal footer** (owner correction 2026-06-11) and its leftover
  popup opens as a **bottom sheet**.
- **Day “⋯” menu** (S9): a bottom sheet in the day bar (+ Repas · Tout copier hier · Vider · undo/
  redo · ✨ Proposition IA) — the desktop controls row is hidden ≤560px.

All Repas overlays are **bottom sheets** on mobile (food picker, custom entry, AI dish analysis,
line/meal/day menus — owner refinement 2026-06-11), anchored just above the bottom nav like every
other screen's sheets. They render **over** the meal-tabs band (the `Modal` portals its scrim to
`<body>`, so it escapes the sticky day bar's stacking context that otherwise trapped a sheet under
the tabs). Mechanism: mobile-only CSS + `useIsMobile()` render gates → desktop byte-identical.

## Line-list grid (Recipe ingredient builder) — instance B

Same line component, **different column map** (no pin; wider numerics):
`grid-template-columns: 14px 1fr 72px 42px 32px 32px 32px 18px`
(grip · name · qty+unit · kcal · L · G · P · del). Row `min-height:34px`;
total row on `--bg-elev`. Recipe-ingredient rows can carry a `recette` badge
(`--recipe`). `.line:hover` fill = `--bg-elev-2` (AUTO-normalised; recipe mockup
had `--bg-elev`).

> A and B are **one component, two configurations** — not a conflict
> (NORMALIZATION_LOG #7). Share: row paddings (`0 10–12px`), numeric fonts, hover
> fill, edit/empty states, qty cell, unit chip, drag affordances.

## Quantity cell + unit chip

`.qtycell` right-aligned flex: a borderless numeric `.qty` input
(`--font-num; --fs-12; width 36–42px; transparent border` → hover `--border`,
focus `--focus` + `--bg-field`) and a `.unit` chip (`--font-num; --fs-10;
--text-faint; max-width 44–54px; ellipsis`) that opens the unit menu on click
(hover → `--accent` + `color-mix(--accent 10%)`). Custom lines show a static
`g`/`—` instead of an input.

**Chip label.** SI units show the unit verbatim (`g`/`ml`/`kg`). A **named
portion** shows the compact abbreviation **`nb`** (B-031) — a display-only label,
**not** a generic "nb" unit (the underlying unit stays the food's specific named
portion; `screens/meals.md`). The full portion identity lives in the unit menu
(`label (grams g)`, e.g. `œuf (57 g)`) and in the chip's **tooltip**: hovering the
chip shows `label (grams g)` for a portion (B-032), the plain unit otherwise.

## States

- **default / hover / clickable**.
- **sorted** (header + arrow).
- **empty** — see `states.md` (no foods / empty year / no weigh-ins).
- **loading** — skeleton rows.
- **archived** — dimmed row + suffix.

## Mobile: row → card list + shared list chrome (mobile-responsive S5)

On phones (≤560px) the dense tables don't fit. Each list screen renders a **card list**
instead of its `<table>`, chosen by a `useIsMobile()` render-switch (spec §0.1) — desktop
renders the **exact existing** table component, untouched. The card components are fed the
**same** API rows the tables consume (no recomputation; CLAUDE.md rule 2). First consumer:
**Journal** (`mockups/02-journal.html`); Recettes/Aliments/Poids follow the same pattern.

- **Row → card.** One card per record on `--bg-elev`, `--r-lg`, `--border` (hover
  `--border-strong`); the **whole card is the tap target**. Journal keeps its day-state
  **left band** (JR-1/B-077) on the card — green `--ok`, yellow `--accent`, red `--nok`
  (+ a soft `--nok-soft` full-card tint); the verdict shows as a **static** pill (the
  interactive badge moves into the editor sheet). Macros keep the L·G·P order + per-macro
  colours (`--c-fat`/`--c-carb`/`--c-prot`). **Card colour cues carry the meaning so the
  desktop state legend is omitted on mobile** (owner decision, 2026-06-10): **calories** are
  tinted by the day **verdict** (same OK `--ok` / NOK `--nok` rule as the badge; default
  colour when no verdict), and the **activity** value is tinted by its **level** (the
  B-085/B-101 palette, revised B-152 — sedentary `--nok` → lightly `--accent` → moderate
  `--ok` → intense `--blue` → extreme `--violet` — shared with `ActivitySelect` and the
  Poids period pill).
- **Tap → editor.** Tapping a card opens a **bottom-sheet editor** (`Modal mobile="sheet"`,
  overlay taxonomy §0.2) exposing the same fields the desktop row edits inline (Journal:
  kcal on summary days, verdict override, activity, comment), **reusing the same
  components** (`VerdictBadge`, `ActivitySelect`, `CommentCell`) and the same PATCH
  round-trip — so a mobile edit and a desktop edit are the same mutation. Where the desktop
  row **also navigates** (Journal date/macros → that day's Repas), the sheet carries an
  explicit **"Ouvrir la journée"** action so no desktop affordance is lost (owner decision,
  2026-06-10).
- **List + detail (Poids, mobile-responsive S8).** Where a desktop row carries **too many
  figures for one card** (the Poids period table has 15), the card stays a **compact list
  row** showing only the four at-a-glance figures (période/durée · Poids · Δ · Déficit/j +
  chevron, the Δ/déficit tinted by the existing WV-1/B-115 trend tones). Tapping it opens a
  **read-only detail bottom sheet** (`Modal mobile="sheet"`) with **all** the figures grouped
  (Poids / Énergie / Contexte — none dropped), reusing the same `format`/`period-style`
  helpers as the table. The sheet carries a **"Modifier la pesée"** action opening the
  weigh-in form **full-screen** (`Modal mobile="fullscreen"`) — the phone equivalent of the
  desktop row's direct click-to-edit, resolved to the period's ending weigh-in. The sheet also
  carries a **"Voir les jours"** action (B-225) opening the read-only interval-days recap popup —
  the phone entry point for the desktop 📋 button column (for the open-interval lead row, which has
  no detail sheet, the same action lives in its open-period modal). The desktop
  `PeriodTable`/`PeriodRow` gain the 📋 column but keep the render-switch (mobile list ≤560px).

### Shared mobile list chrome (`components/ListChrome/*`)

A sticky **toolbar** + bottom-sheet controls shared by every mobile list — created with its
first consumer (Journal) and reused **read-only** by Recettes/Aliments/Poids. Mobile-only by
construction (mounted only inside the `useIsMobile()` branch), so it never affects desktop.

- **`ListToolbar`** — sticky under the app bar (`top: var(--appbar-h)`;
  `z-index: var(--z-sticky-sub)`; `background: var(--bg)`; bottom `--border`): a `leading`
  slot (the screen's year selector / search) on the left, trailing action controls on the
  right.
- **`SortSheet`** (Trier) — a toolbar button opening a sheet listing the screen's sort
  keys + the active direction (▲/▼): the phone equivalent of the desktop sortable headers.
  Selecting a key calls the screen's existing `onSort(key)` (switch key / toggle direction —
  identical to clicking a `SortableTh`); the sheet stays open so the flip is visible.
- **`FilterSheet`** (Filtrer) — a toolbar button opening a sheet of **single-select** filter
  options, the first being the "all / no filter" reset; selecting an option applies it and
  closes. The button reads **active** (`--accent`) when a non-default option is applied. First
  consumer: the **Journal month filter** (the months that have data this year, a presentation-
  only client filter like the sort).
- **`FiltersSheet`** (Filtrer, **multi-control** — mobile-responsive S6) — the same funnel
  button + active state, opening a sheet that stacks **several filter sections** in one place:
  a single-select **chip group** (reusing the `Chip` component) and/or a boolean **toggle**.
  The button reads **active** when any section is off its default; the sheet stays open across
  selections (several controls) and closes via the Modal. First consumer: the **Recettes**
  filters (min-rating chips + show-archived toggle, the desktop `FiltersPopover` controls in
  one sheet); reused **read-only** by Aliments (S7).
- **`OverflowMenu`** (⋯) — a sheet of secondary, full-width actions (e.g. **Export CSV**,
  moved off the visible toolbar on a phone).

**Icon-only toolbar controls (convention, owner decision 2026-06-10).** The toolbar chrome
controls (Trier, Filtrer, ⋯) render as **icon-only** square `--tap` buttons — no visible text
label — with the label carried by `aria-label`/`title` for a11y. This is the standing
convention for **list-screen toolbar controls across the app** (Journal S5, Recettes S6,
Aliments S7, Poids S8). It governs these compact chrome controls only; **action buttons**
(Save, Export, Cancel, primary CTAs) keep their text labels.

All controls reuse the existing **tap target** (`--tap`), radii (`--r-md`), and the S2 Modal
`sheet` variant. **No new token.**
