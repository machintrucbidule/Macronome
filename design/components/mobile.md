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

| Overlay          | Used for                                                                                                                                                                                                                                            | Basis                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Bottom sheet** | **Every modal**: big forms (recipe builder, food, weigh-in), short editors / menus (Journal day, food-line, Repas picker, Poids period detail, account menu, Trier, Filtres) **and** confirmations (delete meal, clear day, archive, typed-confirm) | `Modal` (default mobile presentation) |

Desktop (≥561px) keeps every modal's centered `size` dialog unchanged. The `fullscreen` and
centered-on-mobile variants were retired in MS-1. See `modals.md` for the sheet CSS and
`bottom-nav.md` for the shell pieces.

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
- **Out of scope:** pull-to-refresh, landscape-specific layouts, offline.
