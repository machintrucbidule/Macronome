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
  `background:var(--bg)`, `z-index:var(--z-popover)` range.
- **tbody td**: `padding:7–9px 10px; border-bottom:1px solid var(--border)` (or
  `color-mix(--border 50%)` for lighter inner rows). Numeric cells `--font-num;
  tabular-nums; white-space:nowrap`; first/name cell left, `--font-body`.
- **row hover**: `background:var(--bg-elev-2)` (or `color-mix(--bg-elev-2 70%)`).
- **clickable row**: `cursor:pointer` + `title`.
- **sortable header**: `cursor:pointer; user-select:none`; hover `color:var(--text)`;
  sorted state `.sorted` shows the arrow (`.arr`) in `--accent`; arrow flips ▼/▲.
  (Aliments: Nom·kcal·L·G·P·Note·Visib sortable; **Portion not sortable** —
  DECISIONS Gap #10.)
- **scroll container**: `.tblscroll{max-height:420px; overflow:auto}` for long
  period tables (Poids), with sticky header.
- **archived row**: `opacity:.45`; name suffixed `· archivé` via `::after`
  (`--font-num; --fs-10; --text-faint`).
- **row icon actions**: hidden until hover (see foundations icon buttons);
  archive 🗑 / restore ↺ / delete ×; destructive hover → `--nok`.

## Macro cells (Journal)
`.mF→var(--c-fat)`, `.mC→var(--c-carb)`, `.mP→var(--c-prot)`; `.none →
var(--text-faint)` em-dash when a day has no macro detail.

## Line-list grid (Repas meal column)  — instance A
A meal `.meal` is a flex column on `--bg-elev`, `min-height:200px`, first column
gets `--r-lg` left corners. Header `.meal-head` (name in `--font-display
--fw-bold --fs-14` + cook 🍳 + ⋯ menu). Lines via CSS grid:
`grid-template-columns: 7px 1fr 74px 34px 26px 26px 26px 15px 15px`
(grip · name · qty+unit · kcal · L · G · P · pin · del). `.lhead` row `--fs-9`
uppercase. Line `min-height:32px`. Footer `.meal-foot` = totals on `--bg-elev-2`.
Line states: `.empty` (italic faint "+ aliment"), `.zero` (dimmed), `.pinned`
(`box-shadow: inset 3px 0 0 color-mix(--accent 70%)` + accent 📌), `.editing`
(`background:var(--bg-field)`, inline search input), `.dragging` (`opacity:.4`).
Hover reveals grip/pin/del. A meal keeps ≥2 trailing empty lines, ≥15 lines min.

## Line-list grid (Recipe ingredient builder)  — instance B
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

## States
- **default / hover / clickable**.
- **sorted** (header + arrow).
- **empty** — see `states.md` (no foods / empty year / no weigh-ins).
- **loading** — skeleton rows.
- **archived** — dimmed row + suffix.
