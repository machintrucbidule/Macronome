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

Fixed to the viewport bottom, full width, the **7 primary routes** as **icon + short label**;
the desktop top nav's order is preserved: **Repas · Journal · Poids · Aliments · Recettes ·
Stats · Conseils** (Conseils appended by B-311). Both navigations read the **same**
`app/nav-items.ts` list — see `top-nav.md`.

- Container: `position:fixed; left:0; right:0; bottom:0; display:flex`,
  `background:var(--bg-elev)`, `border-top:1px solid var(--border)`, height ≈ **56px** +
  `padding-bottom: env(safe-area-inset-bottom)` (safe-area inset). `z-index` sits
  **between `--z-sticky-sub` (40) and `--z-appbar` (50)** — `calc(var(--z-appbar) - 1)`.
  The whole `<nav>` is `display:none` by default and only shown inside
  `@media (max-width: 560px)`.
- **5 tabs visible, the bar scrolls horizontally — [B-312].** Items are `flex: 1 0 20%`, so
  five fill the width exactly and the remaining two overflow; the container is
  `overflow-x: auto` with its scrollbar hidden (`scrollbar-width: none` +
  `::-webkit-scrollbar { display:none }`). Seven equal slots would put ~51px under an 8-character
  label at 360px, where the labels already touched at six. This is the construction the Repas
  meal-tab band already ships (`MealTabs`), reused rather than invented.
- **The active tab is scrolled into view** whenever the route changes —
  `scrollIntoView({ inline: 'nearest', block: 'nearest' })`, the same call `MealTabs` uses — so
  the current screen is never the one hidden off-edge.
- **Edge fade.** A soft fade marks the side that has hidden tabs: right while there is more to
  the right, left once scrolled to the end, both in between, none when everything fits. It is a
  `mask-image` on the bar itself (no extra element), driven by a `data-fade` attribute the
  component updates on scroll.
- Item `a`: equal-flex column (icon over label), the **normal text family** (`--font-body`, i.e.
  _not_ `--font-num` — the monospace advance is ~20% wider and was half the collision), label
  `--fs-9` (12px at the phone breakpoint per the responsive type layer) with
  `white-space: nowrap`, `color:var(--text-dim)`, min-height `--tap`. **Active** item (and the
  matching route) in `color:var(--accent)`. Repas is active on **both** `/` and `/day/:date`
  (B-014), reusing the same `mealsActive` rule as the top nav.
- **Icon contract — [B-312].** All glyphs live in `app/nav-icons.tsx` and are drawn as
  **stroke SVGs** on a 24×24 viewBox: `fill:none; stroke:currentColor; stroke-width:1.7`, and
  **`stroke-linecap:round; stroke-linejoin:round`** — the wrapper must declare the joins, which
  it did not before B-312, which is why the bar rendered butt caps while the taskbar copies of the
  same marks declared round. Every glyph fills the **same optical square** and shares one
  **vertical extent (y ≈ 3 → 21)**; a mark that cannot fill it is redrawn rather than left short.
  The set: **Repas** fork _(three tines, bowl, full-length stem)_ + knife — the two utensils end
  at the same baseline; **Journal** calendar; **Poids** square bathroom scale with dial and
  needle; **Aliments** apple; **Recettes** open book with a central spine; **Stats** three bars on
  a baseline; **Conseils** stroke lightbulb with its two base lines.
  (Before B-312 this section described a "Repas metronome" — the glyph has always been a fork and
  knife; the metronome is the brand `.tick` in the appbar.)
- The page body gets a **bottom padding** ≤560px (`AppShell` `.page`/`.pageFlush`) to
  clear the bar: `calc(56px + env(safe-area-inset-bottom) + var(--sp-5))`.

## FAB `.fab` (new `Fab` component — contextual “+”)

A single floating **“+”** button, bottom-right, **above** the bottom bar, safe-area
aware. Its action opens that screen’s **add form** (food / recipe / weigh-in / container) —
as a **bottom sheet**, like every other mobile overlay since MS-1 retired the `fullscreen`
variant (`mobile.md` §Overlay taxonomy). This line said `Modal mobile="fullscreen"` until
B-312; the variant no longer exists.

**Which screens have one — [B-328].** **Aliments · Recettes · Poids · Contenants.** The rule is
structural, not a list of primary screens: a screen gets the FAB when its phone layout is a **card
list whose main action is "add one"**. Contenants is exactly that — the same toolbar + cards +
add-sheet shape as Aliments and Recettes — so it has one, and being a secondary (account-menu)
screen is irrelevant. Repas, Journal and Stats do not: their add actions are per-meal / per-day /
none at all, so a single screen-level “+” would have nothing unambiguous to do.
_(This paragraph read "shown only on Aliments / Recettes / Poids; absent on … the secondary
screens" until B-328. The shipped app had had a Contenants FAB since that screen's mobile slice;
the three-screen wording predated it rather than deciding against it, and the owner kept the
control — removing a working thumb-reachable button to satisfy a sentence would have been the worse
outcome.)_

- `position:fixed; right:var(--page-gutter)`,
  `bottom: calc(56px + env(safe-area-inset-bottom) + var(--sp-5))` (clears the bottom
  bar), circular, `background:var(--accent); color:var(--accent-ink)`, `box-shadow`,
  `--fs-24` glyph, min `--tap` × `--tap`. `display:none` ≥561px.
- Props: `onClick`, `label` (`aria-label`). **Created in S3 but placed by each screen**
  (wired in S6 Recettes / S7 Aliments / S8 Poids, and on Contenants with its own mobile slice),
  so `AppShell` is not touched again after S3.

## Chrome text is not selectable — [B-258]

`.bottomnav` and the Repas meal-tab band set `user-select: none`; their labels inherit it. On a
phone this also stops the long-press text-selection callout from firing on a tab. The enumeration
of what counts as furniture — and what stays copyable — lives in `top-nav.md`.

**Its glyphs are reused by the taskbar shortcuts** (B-259): four of the five jump-list icons are
these exact paths, so the same mark identifies a destination in the tab bar and in the OS menu. A
guard test fails the build if one is redrawn without the other — it compares the path data **and**
the round caps/joins, so the two copies cannot drift on style either.

**The shortcut icons have no background — [B-312].** Each `icons/shortcut-*.svg` used to paint an
opaque `rect` in the brand near-black behind its glyph; on Windows' dark jump-list popup that read
as a black square around the drawing. The rect is gone: transparent background, amber glyph
(`#e0b341`), which reads on both the light and the dark popup. The fifth icon (`settings`) has no
tab-bar counterpart and follows the background rule only. The committed PNGs under
`public/shortcuts/` are rasterised from these SVGs by `npm run gen:pwa-assets -w @macronome/web`
and must be regenerated whenever a glyph changes.

## States

- **App-bar title**: reflects the active route; hidden ≥561px.
- **Bottom nav**: default · active route lit · **scrolled** (fade on the side that hides tabs, the
  active tab pulled into view) · hidden ≥561px.
- **FAB**: shown (its 4 screens, mobile — B-328) · hidden (other screens / ≥561px) · pressed.
