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

## Mobile variants (≤560px) — mobile-responsive S2

On the phone breakpoint (≤560px), a modal may declare a **mobile presentation** that
overrides its centered desktop sizing. This is a **separate `mobile?` prop**, not a `size`
value: `size` still controls the desktop width (unchanged ≥561px), while `mobile` picks the
≤560px shape. The presentation is selected by the `useIsMobile()` hook
(`matchMedia('(max-width: 560px)')`) and is **inert ≥561px** (CSS also scoped inside
`@media (max-width: 560px)`), so **desktop rendering is byte-identical**.

- **`fullscreen`** — `100vw × 100dvh`, `margin:0`, no border/radius; a top bar holding the
  title + a Close (`×`) button (mandatory — the scrim has no reachable outside area);
  scrollable body; `padding-bottom: env(safe-area-inset-bottom)`. For big forms: recipe
  builder, food sheet, weigh-in, cibles, the Repas food picker.

> **Footer actions stay on one tightened row on a phone (owner decision, 2026-06-10).** A
> three-button footer (the recipe builder's Archiver/Restaurer + Annuler + Enregistrer) overflows
> a 360px full-screen modal at the desktop paddings and clips "Enregistrer". ≤560px the `.actions`
> footer + its buttons get **tighter padding and gaps** (`.actions` padding `14px 8px 16px`,
> `gap: --sp-3`; `.actions button` padding `9px 8px`, `white-space: nowrap`) so all three fit
> **one line** while keeping the left/right grouping (Archiver left, Annuler/Enregistrer right) —
> Space Mono is monospace, so the worst case leaves ~18px spare at 360px. Mobile-only; desktop
> footers are unchanged.

- **`sheet`** — bottom-anchored **above the bottom tab bar** (the scrim's bottom is offset by
  the nav height, `calc(56px + env(safe-area-inset-bottom))`, so the primary nav **stays
  visible and tappable** while a sheet is open — owner decision, 2026-06-10), full width,
  rounded **top** corners only (`--r-lg --r-lg 0 0`), slides up (`@keyframes sheet-up`,
  `translateY(100%)→0`), `max-height: calc(90dvh - 56px)`, scroll body; the sheet rests on the
  nav (which already clears the safe-area inset) so it needs no extra bottom inset of its own;
  same title+Close top bar; a tap on the scrim above the sheet closes it. For short editors /
  menus: Journal day editor, Repas food-line editor, Poids period detail, account menu, Trier,
  Filtres, small menus.

> **Focus an animated overlay with `preventScroll` (applies to every animated overlay).** The
> focus trap moves focus into the panel on open. A bare `.focus()` makes the browser scroll the
> focused element into view — and while the panel is animating in (the sheet's slide-up, any
> future enter transition) the element is mid-transform / partly off-screen, so the scroll chases
> its transient position and fights the animation: on mobile the panel visibly **overshoots then
> settles** ("rises too high, comes back down"). Always focus with `.focus({ preventScroll: true })`
> (see `useFocusTrap.ts`); the trap's Tab-cycling `.focus()` calls use it too, to avoid scroll
> jumps when tabbing a tall sheet. _(Diagnosed via the S3 account sheet — the sheet variant's first
> consumer; the variant was dormant in S2. The animation itself was never the problem.)_

### Overlay taxonomy (one interaction language across screens)

| Overlay               | Used for                                                                                     | Basis                                                         |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Full-screen sheet** | Big forms (recipe builder, food sheet, weigh-in, cibles, Repas food picker)                  | `Modal` `mobile="fullscreen"`                                 |
| **Bottom sheet**      | Short editors / menus (Journal day, food-line, Poids period detail, account, Trier, Filtres) | `Modal` `mobile="sheet"`                                      |
| **Centered dialog**   | Confirmations (delete meal, clear day, archive, typed-confirm)                               | `Modal` (current centered behaviour, unchanged on mobile too) |

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

md-size. Name (+ duplicate warning), 4 macro inputs /100g (`grid4`), a ghost
**"Parser macro"** button under the grid (opens the parse sub-dialog below, PM-1/B-114),
named-portions editor (`.portions`: header + `.prow` label/grams/remove rows, or
`.empty`), rating picker, visibility toggle, comment textarea, an `.editnote`
(edit affects future days only), `.dupwarn` (accent inline warning). After a successful
parse, a discreet non-blocking note `.parsenote` (`--font-num; --fs-11; --text-dim`) may
appear under the grid (value guessed from kJ, scaled from a reference weight, or some
macros not found). Footer: left Archiver (danger), right Annuler/Enregistrer.
States: add · edit · duplicate-name warning · parse-note shown · archive→confirm.

## Parse-label sub-dialog (Aliments, PM-1/B-114)

confirm-size. A focused paste dialog over the Food add/edit modal. Anatomy: a `.sub`
intro ("colle le tableau nutritionnel"), a full-width **paste textarea** (`min-height
~140px`, `--font-body`, `resize:vertical` per `forms-inputs.md §Textarea`), an inline
**error row** (`--nok`, hidden until a parse fails), and an actions footer with a ghost
**Annuler** + primary **Parser**. **Parser** calls `POST /foods/parse-label`: on success
it fills the modal's macro fields and **closes**; on a structured error
(`reconstituted_label` / `no_reference` / `unparseable`) it shows the inline error and
**stays open**, writing nothing. Click-outside / Annuler closes without applying.
States: open (empty) · pending (button disabled) · error (inline, stays open) · applied (closes).

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

## Typed-confirmation modal (irreversible actions)

confirm-size. A stronger confirm for **irreversible, account-wide** actions (the Données
wipe / import-replace, IMP-1). Same shell as the archive confirm, plus a single text field:
the danger button stays **disabled until the user types the exact word** shown in the prompt
(`common.typedConfirm` — e.g. "EFFACER"/"DELETE", "REMPLACER"/"REPLACE"; the word is localized).
Body = a short consequence statement (the destroyed scope bolded) + the prompt label + the field;
Enter submits when the word matches. Footer: right-aligned ghost **Annuler** + danger confirm.
States: open (button disabled) · word matches (button enabled) · pending (both disabled) · confirm.

## States (all modals)

closed · open (scrim + panel) · scroll (long body) · blocked/warn (where the
flow validates) · confirm (destructive). Click-outside on the scrim closes
non-destructive modals.
