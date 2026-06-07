# Modals (incl. cook-mode & leftover-proration)

All modals share the scrim (foundations) + a `.modal` panel; widths form a size
scale.

## Panel base `.modal`

`background:var(--bg-elev); border:1px solid var(--border-strong);
border-radius:var(--r-lg); box-shadow:var(--shadow); max-height:88–92vh;
overflow:auto`.

- **Header**: title `--font-display; --fs-15–16`, padded `14–18px 16–20px`,
  often a `border-bottom:1px solid var(--border)`. Recipe modal uses an inline
  editable name field + a `recette` badge + an `×` close.
- **Sub/intro** `.sub`: `--fs-12.5–13; color:var(--text-dim); line-height:1.45`.
- **Body** `.body`: padded `0 20px 14–16px`.
- **Actions footer** `.actions`/`.mfoot`: `border-top:1px solid var(--border);
padding:14px 20px 20px`; right-aligned ghost + primary; a left-slotted danger
  (Archiver/Supprimer) where applicable (`justify-content:space-between`).

## Size scale — [AUTO-normalised]

- **sm** `width:380px` (`max-width:94vw`) — weigh-in entry, container add/edit.
- **md** `width:min(560px,93vw)` — custom food, food add/edit, leftover.
- **lg** `width:min(960px,97vw)` — recipe builder (two-column `.builder`:
  `minmax(0,1fr) 300px`, collapses to 1 col ≤780px).
- **cook** full-screen takeover — see below.
- **confirm** `width:min(420px,92vw)` — archive confirmation.

## Leftover-proration modal (Repas)

md-size. Anatomy:

- **Lines list** `.lo-lines`: header strip (`--font-num; --fs-9.5; uppercase;
--bg-elev-2`) + checkbox rows `.lo-row` (native checkbox `accent-color:--accent`,
  name `--fs-13`, grams `--font-num; --text-dim`); hover `color-mix(--accent 8%)`.
- **Selection summary** `.lo-sel`: count + cumulative served grams.
- **Inputs grid** `.lo-grid` (2-col): gross weight (number) + container/tare
  select (built-in "Rien (0 g)" + saved containers).
- **Net readout** `.lo-net`: `reste net = brut − tare = <b>` (accent).
- **Preview** `.lo-preview`: per-line `g → new g` rows; the new value `.new` in
  `--delta-neg` weight (the consumed-after-deduction figure).
- **Block-and-warn**: if `net > served` or `gross < tare`, block apply + warn
  (see `toasts-warnings.md`).
  States: open · line selected/deselected · recalc preview · blocked(warn) · apply.

## Custom-food modal (Repas)

md-size. 2-col grid of total-value fields (name full-width; kcal, served weight
[optional], L, G, P). Note: "valeurs totales, pas par 100 g; non enregistré".
**Enter submits** the primary action when the form is valid (a positive kcal), no-op
otherwise (B-087) — the panel is a `<div>`, so the key is handled on the body.
States: add (empty) · edit ("Modifier la saisie manuelle") · save.

## Food add/edit modal (Aliments)

md-size. Name (+ duplicate warning), 4 macro inputs /100g (`grid4`), named-
portions editor (`.portions`: header + `.prow` label/grams/remove rows, or
`.empty`), rating picker, visibility toggle, comment textarea, an `.editnote`
(edit affects future days only), `.dupwarn` (accent inline warning). Footer:
left Archiver (danger), right Annuler/Enregistrer.
States: add · edit · duplicate-name warning · archive→confirm.

## Cook-mode modal (Repas) — full-screen touch takeover

Distinct from standard modals. `.cook-scrim` (`rgba(0,0,0,.66)`, no blur,
`z-index:var(--z-cook)`). `.cook-modal`: `96vw × 95vh; flex column`.

- **Head** `.cook-head`: big title `--font-display; --fs-22` + faint subtitle
  ("ajuster les poids réels") + large `×`.
- **Body** `.cook-body` (flex): **list** (left, `flex 1.45`) of large touch rows
  `.cook-row` (name / qty / unit, big type auto-scaled to fit height) + **pad**
  (right) that is either a **numeric keypad** `.numpad` (3-col grid; **disabled/
  greyed by default** until a quantity is tapped: `.disabled{opacity:.3;
pointer-events:none; filter:grayscale(.45)}`) or an **A–Z on-screen keyboard**
  `.azkb` for food swap. Keys: `--font-num`, large; active `:active` →
  `--accent`/`--accent-ink`.
- **Foot** `.cook-foot`: full-width Annuler (ghost-large) + Valider (primary-large),
  `--fs-18`, big padding.
- Its own pop layers: `.cook-ac` (food results) and `.cook-unit-menu`, both
  `position:fixed; z-index:var(--z-cook-pop)` so they sit above the takeover.
- Selected row `.sel` → `color-mix(--accent 12%)`; `.qmode` highlights the qty
  cell with an accent border.
  States: idle (keypad disabled) · qty-edit (keypad active, row `.sel.qmode`) ·
  name-edit (A–Z + `.cook-ac` open) · unit-menu open · validate/cancel.

## States (all modals)

closed · open (scrim + panel) · scroll (long body) · blocked/warn (where the
flow validates) · confirm (destructive). Click-outside on the scrim closes
non-destructive modals.
