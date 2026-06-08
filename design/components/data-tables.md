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
transparent)`, where `--act-color` is set per level by the **same B-085/B-101 palette**
  as `ActivitySelect` (Sédentaire `--nok` → Léger `--accent` → `color-mix(--ok 45%,
--accent)` → `color-mix(--ok 75%, --accent)` → Très intense `--ok`). null → plain em
  dash, untinted.
- **Régime badge** (régime): a pill with **two distinct neutral tints** (no good/bad
  sense) — `.flagDiet` (En régime) = accent soft bg + accent border; `.flagMaint`
  (Maintien) = `--bg-elev-2` bg + `--text-dim` text + `--border`.

## Line-list grid (Repas meal column) — instance A

A meal `.meal` is a flex column on `--bg-elev`, `min-height:200px`, first column
gets `--r-lg` left corners. Header `.meal-head` (name in `--font-display
--fw-bold --fs-14` + cook 🍳 + ⋯ menu). Lines via CSS grid:
`grid-template-columns: 7px 1fr 54px 34px 26px 26px 26px 15px 15px`
(grip · name · qty+unit · kcal · L · G · P · pin · del). The **qty+unit column is
sized to its real content** — the numeric input plus the always-short unit chip
(`g`/`ml`/`kg`/`nb`), not a wide unit label that never renders — so the reclaimed
width widens the `1fr` name column (longer food names show before ellipsis). `.lhead` row `--fs-9`
uppercase. Line `min-height:32px`. Footer `.meal-foot` = totals on `--bg-elev-2`.
Line states: `.empty` (italic faint "+ aliment"), `.zero` (**whole-line muted**:
text cells name/qty/unit/macros in `--text-faint`, grip/📌/× at `opacity:.45` — a
quantity-0 line, e.g. a garde-manger placeholder, reads as inactive; reverts to normal
the instant qty > 0; B-107), `.pinned`
(`box-shadow: inset 3px 0 0 color-mix(--accent 70%)` + accent 📌), `.editing`
(`background:var(--bg-field)`, inline search input), `.dragging` (`opacity:.4`).
Hover reveals grip/pin/del. A meal keeps ≥2 trailing empty lines, ≥15 lines min.

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
