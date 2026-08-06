# Mobile conventions (breakpoint + overlay taxonomy)

Cross-cutting conventions for the mobile-responsive feature
(`specifications/features/mobile-responsive/`, spec §0, §10). Promoted to the live
contract with slice S3, when the phone breakpoint first drives real shell behaviour
(bottom nav, app-bar title, account sheet).

## Breakpoints

- **Phone breakpoint = 560px.** Every mobile rule triggers at
  `@media (max-width: 560px)`. Recorded as the documentation constant
  **`--bp-phone: 560px`** in `tokens.css`. A CSS custom property **cannot** be used
  inside a media-query condition, so the literal `560px` appears in each `@media`; the
  token (and the `useIsMobile()` hook's `matchMedia('(max-width: 560px)')`) carry it for
  documentation / JS use. The single render-switch / overlay-variant signal in code is
  **`lib/useIsMobile.ts`** — true ≤560px, false above (client-only SPA).
- **Reused breakpoint = 760px.** The meal scroller already stacks its columns ≤760px
  (`meal-column.module.css`, `meals.module.css`); it is reused unchanged. Between
  561–760px the type/nav stay desktop while meals stack (existing behaviour). At ≤560px
  the meal tab layer (Repas, S4) takes over from the stacking; the 561–760px stacking is
  never modified.
- **No existing desktop-range breakpoint is modified** (420 / 520 / 640 / 820 / 880 /
  900px etc.). Desktop is never changed silently or by default; a mobile-born
  improvement that would also help desktop is raised as a **separate, flagged proposal**
  for the owner, never folded into a mobile slice.

## How desktop stays identical (mechanism per concern)

| Concern                                                          | Mechanism                                                                  | Desktop guarantee                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Type scale, food-line restyle, sticky toolbars, show/hide chrome | **CSS-only** `@media (max-width:560px)`                                    | inert ≥561px → byte-identical                               |
| Bottom nav, FAB, mobile app-bar title                            | new DOM, **`display:none` ≥561px**                                         | removed from layout + a11y tree                             |
| Lists (table ↔ cards), Poids period table ↔ list                 | **render-switch** via `useIsMobile()`                                      | `false` ≥561px → exact existing component                   |
| Meal tabs (Repas)                                                | new tab-bar DOM `display:none` ≥561px + mobile-only active-meal visibility | ≥561px the tab bar is absent, every column renders as today |

## Overlay taxonomy (one interaction language across screens)

On mobile (≤560px) **every modal is a bottom sheet** — a single overlay language (MS-1). The
sheet is the default mobile rendering of `Modal`; there is no per-modal choice. Cibles is a
**page** (not a popup), so it is not in this table.

| Overlay          | Used for                                                                                                                                                                                                                                                                                                                                    | Basis                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Bottom sheet** | **Every modal**: big forms (recipe builder, food, weigh-in), short editors / menus (Journal day, food-line, Poids period detail, account menu, Trier, Filtres), the three **picker sheets** (Repas food, recipe-builder ingredient, Paramètres garde-manger — MOB-1) **and** confirmations (delete meal, clear day, archive, typed-confirm) | `Modal` (default mobile presentation) |

Desktop (≥561px) keeps every modal's centered `size` dialog unchanged. The `fullscreen` and
centered-on-mobile variants were retired in MS-1. See `modals.md` for the sheet CSS, the shared
picker sheet and the nested-overlay rules, and `bottom-nav.md` for the shell pieces.

**Dismissal includes the hardware/gesture Back** (B-269): it closes the top-most sheet and leaves
the screen underneath in place, instead of navigating away and unmounting the sheet as collateral.
Nested sheets close one at a time. This taxonomy previously named only the scrim tap and the
header `×` — on the form factor where Back _is_ the dismissal gesture, that was the omission that
cost the user whatever they were typing. The rule and its stack live in `modals.md`.

## Mobile horizontal-overflow safety net (S3)

The shell root (`AppShell` `.root`) gets **`overflow-x: clip`** at ≤560px. A screen whose
content is not yet mobile-adapted overflows horizontally; on mobile that **expands the
layout viewport**, which dislocates every `position:fixed` element (the bottom tab bar
drifts below the fold, the account sheet's scrim drifts down-and-right). Clipping the
horizontal overflow keeps the layout viewport equal to the visual viewport, so the fixed
shell stays pinned. `clip` (not `hidden`) is deliberate: it creates **no** scroll
container (the sticky app bar / table headers keep sticking to the viewport) and **no**
containing block (the fixed `BottomNav` stays viewport-fixed and unclipped). **Interim
cost:** content wider than the screen is clipped (no side-scroll) on un-adapted screens
until each page's slice (S4 Repas, S5–S8 lists) reflows it.

## Cross-cutting rules

- **Inputs ≥16px** on mobile (the type layer makes `--fs-13` = 16px) to avoid iOS focus
  zoom; numeric fields use `inputmode="decimal"`/`numeric`.
- **Safe-area insets** on the bottom bar and FAB (`env(safe-area-inset-*)`).
- **Animated overlays focus with `preventScroll`.** Any overlay that animates in must move
  focus with `.focus({ preventScroll: true })`; a bare `.focus()` scroll-into-view fights the
  enter animation and makes the panel overshoot on mobile. See `modals.md` (handled in
  `useFocusTrap.ts`).
- **Date headers stay single-line (DH-1).** Where a screen shows a compact date on mobile
  (Repas day band), it renders on **one line, no wrap**: the localised month is abbreviated
  to its **first 4 letters** (any locale — keeps juin/juil · June/July distinct) and the
  date text / adjacent controls are trimmed to fit rather than wrapping.
- **Swipe a date band to change day (DH-1).** A horizontal swipe on a day's date band
  navigates day-to-day — **swipe-left = next, swipe-right = previous** — mirroring the ‹ ›
  arrows. Gestures starting on a button/input/menu keep their own behaviour (shared swipe
  hook). Same direction convention as the Repas meal-tab swipe (`dir −1/+1`).
- **One-tap dish photo in the meal header (QP-1/B-158).** On the phone layout, the meal-column
  header shows a **📷 + badge** button in the slot of the (hidden ≤560px) 🍳 cuisine button: it
  opens the camera, auto-runs the AI dish-photo analysis, and opens the custom line pre-filled at the
  first free slot. Shown only when the dish-photo AI task is configured; hidden on desktop. See
  `ai-dish-analysis.md`.
- **Out of scope:** pull-to-refresh, landscape-specific layouts, offline.
