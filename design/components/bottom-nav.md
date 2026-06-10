# Bottom nav + FAB + mobile app-bar title (mobile shell, ≤560px)

The phone-only shell pieces introduced by the mobile-responsive feature
(`specifications/features/mobile-responsive/`, spec §2, slice S3). All three are
**additive and `display:none` ≥561px**, so they are removed from the desktop layout and
the a11y / tab tree — **desktop rendering is byte-identical**. They complement the
desktop top nav (`top-nav.md`), which stays the navigation surface ≥561px.

## Mobile app-bar title (≤560px)

On the phone breakpoint the appbar swaps its **wordmark** for the **current screen
title** (derived from the route inside `AppShell`); the desktop **primary nav** `.nav`
and the **theme segmented toggle** are hidden (the theme toggle moves into the account
sheet, below). The bar then reads: brand `.tick` + `.appbarTitle` + avatar.

- `.appbarTitle`: `--font-display; --fs-16; --fw-bold`, `display:none` by default, shown
  only inside `@media (max-width: 560px)`. The wordmark / nav / theme-toggle wrapper are
  `display:none` inside the same media query.
- Title source: a `pathname → i18n key` map in `AppShell` (Repas for `/` and `/day/:date`,
  then Journal / Poids / Aliments / Recettes / Stats, and the secondary destinations).

## Bottom tab bar `.bottomnav` (new `BottomNav` component)

Fixed to the viewport bottom, full width, the 6 **primary** routes as **icon + short
label**; the desktop top nav's order is preserved: **Repas · Journal · Poids · Aliments ·
Recettes · Stats**.

- Container: `position:fixed; left:0; right:0; bottom:0; display:flex`,
  `background:var(--bg-elev)`, `border-top:1px solid var(--border)`, height ≈ **56px** +
  `padding-bottom: env(safe-area-inset-bottom)` (safe-area inset). `z-index` sits
  **between `--z-sticky-sub` (40) and `--z-appbar` (50)** — `calc(var(--z-appbar) - 1)`.
  The whole `<nav>` is `display:none` by default and only shown inside
  `@media (max-width: 560px)`.
- Item `a`: equal-flex column (icon over label), `--font-num`, label `--fs-9`,
  `color:var(--text-dim)`, min-height `--tap`. **Active** item (and the matching route)
  in `color:var(--accent)`. Repas is active on **both** `/` and `/day/:date` (B-014),
  reusing the same `mealsActive` rule as the top nav.
- Icons: simple **stroke SVGs** (`fill:none; stroke:currentColor; stroke-width:1.7`,
  24×24 viewBox) — the reference set is `mockups/01-shell.html` (Repas metronome,
  Journal calendar, Poids scale, Aliments leaf, Recettes book, Stats bars).
- The page body gets a **bottom padding** ≤560px (`AppShell` `.page`/`.pageFlush`) to
  clear the bar: `calc(56px + env(safe-area-inset-bottom) + var(--sp-5))`.

## FAB `.fab` (new `Fab` component — contextual “+”)

A single floating **“+”** button, bottom-right, **above** the bottom bar, safe-area
aware. **Shown only on Aliments / Recettes / Poids**; absent on Repas, Journal, Stats and
the secondary screens. Its action opens that screen’s **full-screen add form** (food /
recipe / weigh-in — the `Modal mobile="fullscreen"` variant).

- `position:fixed; right:var(--page-gutter)`,
  `bottom: calc(56px + env(safe-area-inset-bottom) + var(--sp-5))` (clears the bottom
  bar), circular, `background:var(--accent); color:var(--accent-ink)`, `box-shadow`,
  `--fs-24` glyph, min `--tap` × `--tap`. `display:none` ≥561px.
- Props: `onClick`, `label` (`aria-label`). **Created in S3 but placed by each screen**
  (wired in S6 Recettes / S7 Aliments / S8 Poids), so `AppShell` is not touched again
  after S3.

## States

- **App-bar title**: reflects the active route; hidden ≥561px.
- **Bottom nav**: default · active route lit · hidden ≥561px.
- **FAB**: shown (its 3 screens, mobile) · hidden (other screens / ≥561px) · pressed.
