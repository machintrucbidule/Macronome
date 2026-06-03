# Tokens — reference & usage map

`tokens.css` is authoritative. This file documents the scales that aren't pure
colour variables (type, spacing, breakpoints, z-index, motion) and maps each to
where it shows up in the mockups, so the build applies them consistently.

## Themes
- Default = **dark** (`:root` and `[data-theme="dark"]` carry identical values).
- **light** = `[data-theme="light"]` override block.
- Switch by setting `data-theme` on `<html>`. Body cross-fades via
  `transition: background var(--dur-theme) var(--ease), color var(--dur-theme) var(--ease)`.
- See `theming.md` for the full strategy (system/light/dark resolution).

## Type scale (px)
| Token | Use |
|---|---|
| `--fs-9` | tags, table sub-headers, micro legends |
| `--fs-10` | uppercase section labels, chart axis labels |
| `--fs-11` | nav links, segmented controls, meta, pills, hints |
| `--fs-12` | dense table cells, secondary controls |
| `--fs-13` | body default, inputs, menu items, account/settings rows |
| `--fs-14` | meal/card titles, primary inputs, panel headers |
| `--fs-15` | login fields, OK/NOK verdict badge |
| `--fs-16` | wordmark, date label, section h1 (toolbars at 18) , metric value |
| `--fs-18` | page h1 in toolbars (Aliments, Recettes) |
| `--fs-20` | page h1 (Poids, Stats, Journal, Cibles) |
| `--fs-22` | page h1 (Paramètres, Compte), cook-mode title |
| `--fs-24` | big numeric value (Calories card, cartouche stat) |

Rules: anything numeric (kcal, grams, kg, %, dates, table figures) uses
`--font-num` with `font-variant-numeric: tabular-nums`. Titles/wordmark use
`--font-display` (Space Mono, weight 700). Prose/labels use `--font-body`.

## Spacing
`--sp-1..--sp-10` (2,4,6,8,10,12,14,16,20,24). Horizontal page padding is always
`--page-gutter` (18px) — appbar, toolbars, panels, tables, heads. Vertical
section padding clusters at 10–14px; card inner padding 9–16px.

## Breakpoints (desktop-first)
| Name | Max-width | Behaviour (from mockups) |
|---|---|---|
| `lg` | 900px | metric/cartouche/strip grids collapse to 2-up or 3-up; main `.nav` hidden |
| `md` | 760px | meal scroller stacks vertically (one meal per row); `--tap` → 44px; nav arrows/scrollbar hidden |
| `sm` | 520px | totals grid → 2 columns; tightest dense layouts wrap |
| `xs` | 420px | login card padding tightens |

Note: individual screens used nearby values (820/880/780); these are folded to
the nearest canonical breakpoint above. The main-nav-hidden rule fires at `lg`.

## Z-index layers
Canonical ladder in `tokens.css` (`--z-*`). The mockups used ad-hoc values
(40→340); they collapse to: sticky-sub 40 < appbar 50 < popover 60 < menu 80 <
autocomplete 90 < scrim/modal 100 < cook takeover 300 (+ its pop layers 330) <
toast 1000.

## Motion
- `--ease: cubic-bezier(.2,.7,.2,1)` everywhere.
- `--dur-fast .15s` hover/focus; `--dur-bar .2s` progress fills; `--dur-theme
  .35s` theme cross-fade.
- Named keyframes used by the brand/login (kept as component-local, not tokens):
  `swing` 2.6s (tick needle), `spin` .7s (submit spinner), `rise` (card entrance).
