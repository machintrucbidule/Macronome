# Foundations — shared primitives

Cross-cutting primitives reused by many components. All values from the mockups,
reconciled per `../NORMALIZATION_LOG.md`. Every component consumes semantic
tokens from `../tokens.css`.

## Surfaces & elevation

Three stacked surfaces, dark→light in dark theme:

- `--bg` — page background.
- `--bg-elev` — primary raised surface (appbar, cards, panels, meal columns).
- `--bg-elev-2` — secondary raised surface (menus, popovers, inner tiles, table
  hover, segmented-control track).
- `--bg-field` — recessed input wells (text fields, qty inputs).

Borders: `--border` default hairline (`1px`); `--border-strong` for emphasis
(menu edges, focused dividers, sticky table-header underline). Standard card:
`background:var(--bg-elev); border:1px solid var(--border); border-radius:var(--r-lg)`.
Inner tiles inside a card step down to `--r-md` + `--bg-elev-2`.

### Shadow ladder (floating layers) — [B-255]

Surface stacking says **which plane** a thing sits on. It cannot say **how far above the page** it
floats, and every floating layer lands on the same `--bg-elev-2` — so with a single `--shadow`
(50px blur) a small tooltip carried the same weight as a modal, flattening the hierarchy the
stacking was meant to express. Three tiers, both themes:

| token         | for                                                           |
| ------------- | ------------------------------------------------------------- |
| `--shadow-sm` | tooltips — barely off the page                                |
| `--shadow-md` | menus, popovers, autocomplete, the calendar and filter pops   |
| `--shadow`    | modals, bottom sheets, toasts, the FAB, cook mode, auth cards |

`--shadow` **keeps its name and its value**: that is what let the ladder land without touching the
~20 existing consumers — only the layers that should soften were re-pointed. The ladder is
elevation, not decoration: a layer's tier follows how far it floats, never how important it feels.

### Native surfaces follow the theme — [B-257]

The browser draws scrollbars, `<select>` popups, date pickers and form widgets itself, and in a
dark-by-default app they painted **light** — the loudest "this is a browser, not an application"
tell in the installed window. Both `[data-theme]` blocks therefore declare **`color-scheme`**
(`dark` / `light`), which hands that whole native layer the app's theme in one property.

Scrollbars are additionally styled from `--scrollbar` in `global.css` (`scrollbar-color` for
Firefox, `::-webkit-scrollbar*` for Chromium). The token existed in both themes but had exactly
**one** consumer, so every other scroll area showed the raw OS bar. Two scrollers hide their bar
deliberately (the Repas meal scroller and the mobile meal tabs); the global rule is declared on
element selectors so their class-level rules keep winning.

**`color-scheme` does not cover the autofill highlight [B-305].** The browser also repaints a field
the password manager filled, and that paint is governed separately — it composites over the author
background instead of taking the theme, which is how the login fields came to read olive/yellow. It
is neutralised in `global.css` too, next to the scrollbars: same reasoning, same place, one rule for
every field (`forms-inputs.md` §autofilled has the visual contract).

## Focus ring

Inputs on focus: `border-color: var(--focus)`. The emphasised variant (login
fields, checkbox) adds `box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus)
22%, transparent)`. Invalid: swap focus colour for `--nok` and the ring to
`color-mix(... var(--nok) 20% ...)`. Keep one focus colour = `--focus` (= accent).

## Brand mark ("the tick")

A metronome needle: a circle ring + a swinging needle.

- Ring: `width/height` 22px (appbar) or 26px (login); `border:1.4px solid
var(--accent); border-radius:50%`.
- Needle: `::after`, `1.4px` wide, `8px` tall (10px login), `background:var(--accent)`,
  `transform-origin:bottom center`, animates `swing` 2.6s `var(--ease)` infinite
  (rotate −20deg ↔ +20deg; login uses ±22deg).
- Wordmark: `--font-display`, `--fw-bold`, `--fs-16` (appbar) / 21px (login).
- Favicon (B-011): derived from the tick — ring + a **frozen** needle, accent
  amber baked in (favicons can't read CSS vars). Shipped as `favicon.svg`
  (primary) + `favicon.ico` (32px raster fallback).

## Scrim (modal backdrop) — [AUTO-normalised]

`position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(3px);
z-index:var(--z-scrim)`. Shown via `.show` (`display:grid; place-items:center`).
Cook-mode uses a **distinct** scrim: `rgba(0,0,0,.66)`, no blur, `z-index:var(--z-cook)`.

## Segmented control (`.seg` / toggles) — [AUTO-normalised to app size]

Inline pill group, single-select, `aria-pressed`.

- Track: `display:inline-flex; background:var(--bg-elev-2); border:1px solid
var(--border); border-radius:var(--r-md); overflow:hidden; height:var(--control-h)` (30px).
- Buttons: borderless, transparent, `--font-num`, `--fs-11`, `color:var(--text-dim)`;
  `padding:0 9px`. Selected: `background:var(--accent); color:var(--accent-ink)`.
  Hover (unselected): `color:var(--text)`.
- Optional `.sep`: 1px `--border`, 55% height, centred.
- **Size variant `lg`** (login top-bar): `height:34px; background:var(--bg-elev)`,
  buttons `padding:0 11px`, `letter-spacing:.04em`.
  Used by: theme toggle, FR/EN (login), range/year selectors, Régime/Maintien,
  visibility toggle, type filter. Same anatomy, different option sets.

## Floating panels (dropdowns, menus, popovers)

Every absolutely-positioned panel rendered **inside** the DOM — select menu, verdict menu, unit
menus, the meal ⋯ menu, the autocomplete list — carries a **`max-height` and scrolls**
(`overflow-y:auto; overscroll-behavior:contain`). Without both, a list longer than the room left
in its clipping ancestor is simply cut off, and the wheel chains out to whatever scrolls behind
it. Never rely on "this list is short": several are driven by user data (named portions, the tare
catalog, a fetched model list). Only the right-click context menu is exempt — it is `position:
fixed` and portaled, so no ancestor can clip it.

## Disclosure (`<details>` / `<summary>`)

The native marker is **always** hidden — `list-style:none` on the summary plus
`summary::-webkit-details-marker{display:none}` — and replaced by a `::before` chevron in
`--text-faint`: `▸ ` closed, `▾ ` open (swapped by `[open] > summary::before`). Used by
the Conseils dashboard and every help block (Assistant IA, Google Drive, Home Assistant).
The account-menu avatar is the one disclosure with **no** chevron: its open state is the
filled pill instead (`top-nav.md`).

## Pills / tags

`--font-num`, `--fs-9`, uppercase, `letter-spacing:.05em`, `border:1px solid
var(--border-strong)`, `border-radius:var(--r-pill)`, `padding:2px 7px`,
`color:var(--text-dim)`. Semantic variants recolour border+text via `color-mix`
with the relevant token (e.g. recipe badge → `--recipe`; shared → `--c-carb`;
diet → `--accent`).

## Icon buttons (row affordances)

`opacity:0` at rest, revealed on row hover (`opacity:.65–.7`); borderless,
transparent, `color:var(--text-faint)`, `--fs-13/14`. Destructive hover →
`color:var(--nok); opacity:1`.
