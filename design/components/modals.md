# Modals (incl. cook-mode & leftover-proration)

All modals share the scrim (foundations) + a `.modal` panel; widths form a size
scale.

The scrim is **portaled to `<body>`** (mobile-responsive S9 follow-up, 2026-06-11) so its
`z-index:var(--z-scrim)` always wins against page chrome — a sheet opened from inside a
stacking-context-forming ancestor (e.g. the sticky Repas day bar) would otherwise be trapped
_under_ fixed bars like the meal-tabs band. No visual change; click-outside, Escape and the
focus trap are unaffected.

## Panel base `.modal`

`background:var(--bg-elev); border:1px solid var(--border-strong);
border-radius:var(--r-lg); box-shadow:var(--shadow); max-height:88–92vh;
overflow:auto`.

**Background scroll is locked while any modal is open.** The scrim is `position:fixed`, so a page
scrolling behind an immobile overlay reads as a bug. The lock is **ref-counted** — a nested
sub-dialog closing on its own must not release it — and restores the exact previous inline values.
The removed scrollbar is compensated with matching padding so the page does not jump sideways.
Panel and scrim both carry `overscroll-behavior:contain` as the second line of defence, so
reaching the end of one does not start scrolling the next.

- **Header**: title `--font-display; --fs-15–16`, padded `14–18px 16–20px`,
  often a `border-bottom:1px solid var(--border)`. Recipe modal uses an inline
  editable name field + a `recette` badge + an `×` close.
- **Sub/intro** `.sub`: `--fs-12.5–13; color:var(--text-dim); line-height:1.45`.
- **Body** `.body`: padded `0 20px 14–16px`.
- **Actions footer** `.actions`/`.mfoot`: `border-top:1px solid var(--border);
padding:14px 20px 20px`; right-aligned ghost + primary; a left-slotted danger
  (Archiver/Supprimer) where applicable (`justify-content:space-between`).

## Size scale — [AUTO-normalised]

The `Modal` `size` prop has **three** desktop widths (mobile ignores it — every modal is a
full-width bottom sheet, MS-1). Cook-mode is a separate full-screen takeover, **not** a `size`.

- **md** (default) `width:min(560px,93vw)` — custom food, food add/edit, leftover, Chronodrive
  search, the target engine panels.
- **confirm** `width:min(420px,92vw)` — confirmations, short editors/menus, weigh-in (incl. the
  open-period reduced mode), container add/edit, parse-label, typed-confirm.
- **wide** `width:min(880px,95vw)` — recipe builder (two-column `.builder`:
  `minmax(0,1fr) 300px`, collapses to 1 col ≤780px).

## Mobile presentation (≤560px) — every modal is a bottom sheet (MS-1)

On the phone breakpoint (≤560px) **every modal renders as a bottom sheet** — one mobile overlay
language across the whole app. There is **no per-modal choice**: the sheet is the **default**
mobile rendering of `Modal`, selected by the `useIsMobile()` hook
(`matchMedia('(max-width: 560px)')`) and **inert ≥561px** (the CSS is also scoped inside
`@media (max-width: 560px)`), so **desktop rendering is byte-identical**. `size` still controls
the desktop width (unchanged ≥561px); it has no effect on the mobile sheet (which is full width).

> **History (MS-1).** Earlier revisions (S2) offered three mobile presentations via a `mobile?`
> prop — `fullscreen` (big forms), `sheet` (short editors/menus), and a _centered-on-mobile_
> dialog (confirmations). MS-1 **retired the `fullscreen` and centered-on-mobile variants and the
> `mobile` prop**: a single bottom sheet for everything, **uniform height** (big forms reuse the
> standard sheet height and scroll internally — no dedicated tall-sheet treatment).

- **The sheet** — bottom-anchored **above the bottom tab bar** (the scrim's bottom is offset by
  the nav height, `calc(56px + env(safe-area-inset-bottom))`, so the primary nav **stays
  visible and tappable** while a sheet is open — owner decision, 2026-06-10), full width,
  rounded **top** corners only (`--r-lg --r-lg 0 0`), slides up (`@keyframes sheet-up`,
  `translateY(100%)→0`), `max-height: calc(90dvh - 56px)`, scroll body; the sheet rests on the
  nav (which already clears the safe-area inset) so it needs no extra bottom inset of its own; a
  top bar holds the title + a Close (`×`) button and a tap on the scrim above the sheet closes it.
  The **same uniform height** applies to big forms (food add/edit, recipe builder, weigh-in) —
  they scroll within the sheet.

> **Footer actions stay on one tightened row on a phone (owner decision, 2026-06-10).** A
> three-button footer (the recipe builder's Archiver/Restaurer + Annuler + Enregistrer) overflows
> a 360px sheet at the desktop paddings and clips "Enregistrer". ≤560px the `.actions`
> footer + its buttons get **tighter padding and gaps** (`.actions` padding `14px 8px 16px`,
> `gap: --sp-3`; `.actions button` padding `9px 8px`, `white-space: nowrap`) so all three fit
> **one line** while keeping the left/right grouping (Archiver left, Annuler/Enregistrer right) —
> Space Mono is monospace, so the worst case leaves ~18px spare at 360px. Mobile-only; desktop
> footers are unchanged.

- **`headerAction` (optional top-bar slot).** The sheet's top bar may render one control
  **between the title and the Close `×`** (the title takes the remaining width and truncates).
  Omitted → the bar is exactly title + `×`; desktop is unaffected (the bar only exists on the
  mobile sheet). First consumer: the **account sheet's theme toggle** (moved onto the sheet's top
  row — owner decision, 2026-06-10).

> **Focus an animated overlay with `preventScroll` (applies to every animated overlay).** The
> focus trap moves focus into the panel on open. A bare `.focus()` makes the browser scroll the
> focused element into view — and while the panel is animating in (the sheet's slide-up, any
> future enter transition) the element is mid-transform / partly off-screen, so the scroll chases
> its transient position and fights the animation: on mobile the panel visibly **overshoots then
> settles** ("rises too high, comes back down"). Always focus with `.focus({ preventScroll: true })`
> (see `useFocusTrap.ts`); the trap's Tab-cycling `.focus()` calls use it too, to avoid scroll
> jumps when tabbing a tall sheet. _(Diagnosed via the S3 account sheet — the sheet variant's first
> consumer; the variant was dormant in S2. The animation itself was never the problem.)_

> **Search overlays auto-focus their input (initial-focus target).** A search overlay — the shared
> **picker sheet** (`SearchSheet`, hosted by the Repas food picker, the recipe-builder ingredient
> picker and the Paramètres garde-manger picker) and the Chronodrive search (`ChronoSearchDialog`)
> — must land focus on its **search input** on open so the mobile keyboard opens, **not** on the
> header `×`. The focus trap otherwise focuses the first focusable in DOM order, and the Close
> button is rendered before the body — so it wins and the keyboard never opens. `Modal` therefore
> accepts an **optional `initialFocusRef`**: the overlay passes a ref to its input and the trap
> focuses that ref instead (still with `{ preventScroll: true }`, per the rule above). Overlays
> that pass no ref keep the default (first-focusable) behaviour. The **desktop** inline
> `Autocomplete` (`IngredientSearch`, `InlineFoodSearch`, the pantry picker — ≥561px only) is not a
> `Modal`; it self-focuses its input with the same `preventScroll`.

### Keyboard-aware search sheets (mobile)

On the phone breakpoint a search sheet reacts to the **on-screen keyboard** so its input and first
results never sit behind it:

- A `visualViewport` hook (`lib/useKeyboardViewport.ts`) measures the keyboard's bottom overlap and
  exposes it as `--kb-inset` (0 when the keyboard is closed). The bottom-sheet geometry subtracts it:
  the scrim bottom becomes `calc(56px + env(safe-area-inset-bottom) + var(--kb-inset, 0px))` and the
  sheet `max-height` loses `var(--kb-inset, 0px)`, so the sheet **lifts above the keyboard** and caps
  to the _visible_ viewport. Non-search sheets don't mount the hook, so `--kb-inset` stays 0 and their
  geometry is unchanged.
- The search sheet opts into a **filled body** (`Modal`'s `fillBody`): the panel becomes a flex column
  whose body owns the scroll, so the **search input stays pinned at the top** and the **results scroll
  in their own region** below it (instead of the whole sheet scrolling and pushing the input
  off-screen). Keyboard closed → identical to the standard sheet.

#### The shared picker sheet `SearchSheet` (MOB-1)

One presentational component backs **all three** food/recipe pickers at ≤560px (Repas, the
recipe-builder ingredient block, the Paramètres garde-manger). It is a keyboard-aware search sheet
per the two rules above, and it owns no data: each host passes the query, the mapped items and the
labels, so the three keep their own data sources and wording while behaving identically.

- **Rows**: one tappable row per item (`--tap` minimum height), name (ellipsised) + an optional
  inline tag (`recette` / `portion`). The **current** item carries an inset accent bar — the sheet's
  equivalent of the dropdown's `.cur` outline.
- **Disabled rows** are rendered dimmed and **not tappable** — the sheet's equivalent of the
  dropdown's `.disabled` (a recipe that would create a cycle, `recipe.md`). No tooltip: there is no
  hover on a touch screen, so the affordance is the dimming alone.
- **Empty**: the host's own "no results" label, in `--text-faint`.
- **Custom option**, when the host offers one (Repas only): the same **leading when the trimmed
  query is empty, trailing once the user types** rule as the dropdown (B-159), so the two
  presentations cannot diverge. Hosts that pass none render no such row (the recipe builder allows
  no custom-inline ingredients; the pantry has never had one).
- **Closing**: the header `×`, a tap on the scrim, or Escape. Note this **replaces the dropdown's
  outside-click-to-cancel** on phones (B-049 / B-095): the sheet is portalled to `<body>`, so an
  outside-click listener bound to the host's own subtree would fire on the first tap _inside_ the
  sheet. Hosts therefore mount the inline dropdown **or** the sheet, never both.

### Back closes the top overlay — [B-269]

Before this, an open overlay had exactly two dismissal paths — a scrim tap and Escape — and
**Back navigated the SPA away**, unmounting the overlay as collateral and taking whatever was
being typed with it. On Android and in the installed window that is the primary gesture, so the
most natural way to dismiss a sheet was also the most destructive.

- **Every overlay is covered, everywhere**: mobile, the installed window **and** a desktop
  browser tab (owner decision — one rule, not a per-form-factor exception). On desktop this means
  Back closes the dialog before it navigates: with an overlay open you press it twice.
- **One stack, three keys.** Back reads the same mount-order stack as Escape. Nested overlays
  close **one at a time**, top first, exactly as Escape already does.
- **The history must not accumulate.** Opening an overlay pushes one entry; closing it by any
  other path (Escape, scrim, the header `×`, a save) **consumes** that entry, so a session of
  opening and closing sheets leaves no phantom entries to walk back through.
- **The cook-mode takeover is included** (owner decision). It is full-screen and, on a phone in a
  kitchen, Back would otherwise quit the app instead of leaving the mode.
- **Deep links keep their own rule.** `/weight?action=add` consumes its parameter with a
  `replace` navigation so refresh/back never re-opens the sheet (B-183, `pwa.md`); the overlay's
  history entry must not fight it.

### Overlay taxonomy (one interaction language across screens)

| Overlay          | Used for                                                                                                                                                                                                                                                                                                                                                                         | Basis                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Bottom sheet** | **Every modal on mobile** — big forms (recipe builder, food, weigh-in), short editors / menus (Journal day, Repas food-line/custom/AI/day+meal menus, Poids period detail, account, Trier, Filtres), the three **picker sheets** (Repas food, recipe-builder ingredient, Paramètres garde-manger — MOB-1) **and** confirmations (delete meal, clear day, archive, typed-confirm) | `Modal` (default mobile presentation) |

> On desktop (≥561px) every modal keeps its centered `size` dialog unchanged. The bottom sheet is
> the **only** ≤560px presentation — there is no centered-on-mobile or full-screen variant (MS-1).
> The cook-mode modal (below) is a separate full-screen touch takeover, not a `Modal`.

### Nested overlays (a sheet opened from inside a sheet)

An overlay may open **over** another one. Two ship: the "Parser macro" paste sub-dialog over the
Aliment add/edit modal (PM-1/B-114), and the ingredient picker sheet over the recipe-builder sheet
(MOB-1) — the builder must stay mounted behind it or its draft would be lost. The rules, all
satisfied by the shared `Modal` with no per-overlay work:

- **Stacking** — both scrims portal to `<body>` and share `z-index: var(--z-scrim)`, so **mount
  order decides**: the overlay opened last is appended last and paints on top. There is no second
  z-index layer and none is needed; do not invent one.
- **Escape** — a mount-order stack means Escape closes only the **top-most** overlay. The one
  beneath stays open.
- **Back** — the hardware/gesture Back and the browser's Back button close the **top-most**
  overlay too, reading the **same stack as Escape** so the two can never disagree (B-269). See
  "Back closes the top overlay" below.
- **Focus** — each focus trap binds its Tab handler to **its own panel**, not to the document, so
  the two traps never fight: Tab cycles inside the top overlay only. On close, the trap restores
  focus to whatever was focused before it opened, i.e. back into the overlay beneath.
- **Scrim tone** — the scrims **compound** (each `rgba(0,0,0,.55)` + `blur(3px)`, B-256), so the
  page reads darker and blurrier behind
  two overlays than behind one. Accepted: it is already the rendering of the paste sub-dialog, and
  the extra dimming correctly signals depth.
- **Prefer a hand-off when the state allows it.** Nesting is for the case where the overlay beneath
  owns state that must survive (the recipe draft). Where it does not, close first and then open —
  the Repas line editor's "change the food" does exactly that, so the two never stack.

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

## Open-period modal (Poids, B-176)

confirm-size — a **reduced mode of the weigh-in modal** for the synthetic open interval
(`logic/weight-periods-trajectory.md §2.1`), opened by clicking the open-interval lead row.
It has **no closing weigh-in**, so only the period-level fields are editable:

- **Shown**: the **régime** toggle (En régime / Maintien = `current_mode`) and the **note**.
- **Hidden**: date, weight, waist (no measurement), and the **Delete** action.
- **Save** persists in **one `PATCH /settings`** `{current_mode, open_period_note}` (the régime
  reuses the screen's `current_mode`; the note is the open-period note) — it writes **no**
  `weight_entry`. Title reads as the open period ("… → Aujourd'hui").
- The standard **"+ Pesée"** (add) modal is unchanged in shape but **pre-fills** its note from
  `open_period_note` and its diet flag from `current_mode`; creating that closing weigh-in
  transfers the note and clears `open_period_note`.
- The open-period modal also carries a **"Voir les jours"** action (B-225) — the open-interval
  row's entry point to the interval-days recap popup (see below), since it has no read-only
  detail sheet.

## Interval-days recap popup (Poids, B-225, redesigned B-227)

`md` size — a **read-only** popup listing every calendar day of a period's interval
`[start_date, end_date]` (both bounds inclusive), opened from the desktop 📋 button column or, on
mobile, from the period detail sheet / open-period modal "Voir les jours" action. Reuses the shared
`Modal` (desktop dialog / mobile bottom-sheet via `useIsMobile()` — already listed as "Poids period
detail" in the overlay taxonomy §0.2). **No edit control, no mutation.**

- **Title** — the interval as a readable **compact date range** (`18 juil. 2026 → …`), not the raw
  ISO strings.
- **Recap header** (B-227) — a summary strip under the title: **`N jours · M saisis · moy. K kcal`**
  and, for a closed period, the interval's **weight change** `80,0 → 79,2 kg (−0,8)` (the web already
  holds `weight_end`/`Δ` from the `Period`; omitted on the open interval). `avg_kcal` is server-computed.
- **Column header** — a pinned header row labelling the columns (Date · kcal · **L·G·P** with the
  macro-colour legend shown once).
- **Day rows** — one card per calendar day, all of **uniform height** (the comment slot is **always
  reserved**, so a day with no comment is the same height as one with — B-227). Each card shows: the
  **readable date with weekday** (`Samedi 18 juillet 2026`, `formatDayLong`); the **calories**
  (prominent, verdict-tinted); the **macros L·G·P colour-coded** via `--c-fat`/`--c-carb`/`--c-prot`
  (same tokens as the Journal), right-aligned `tabular-nums`; the **comment** truncated to one line
  (`…`, full text on `title`). A **left colour band keyed to the day's `state`** — `ok` `--ok` /
  `partiel` `--accent` / `nok` `--nok` / `none` `--none` (mirrors the Journal's state band). A
  **not-logged day** shows "non saisi" (muted) but keeps the full card height. **Weekend** rows
  (Sat/Sun) get a subtle tint; **today**'s row is marked "Aujourd'hui".
- **Interaction** — each day card is a **button**; clicking it navigates to that day's Repas screen
  (`/day/:date`) and closes the popup.
- **States** — loading (placeholder) · loaded (list) · empty-interval (all days "non saisi").

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

## Conditional confirmation (per-meal copy, CP-2 / B-248)

The house rule is that a flow which **overwrites existing content confirms first** (Tout copier
hier, Tout effacer, delete meal — the shared confirm modal, never a native `confirm()`). The
**per-meal** "Copier le repas de la veille" is the one **deliberate divergence**: it shows the
confirm **only when the target meal already has lines**, and copies straight away into an empty
meal — the common case, and the reason the button exists. The exception is bounded by its own
condition: the moment there is content to lose, the standard confirm-size modal appears, with the
same shell and wording pattern as the day-level copy. Do not generalise the exception to any other
destructive flow.

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
