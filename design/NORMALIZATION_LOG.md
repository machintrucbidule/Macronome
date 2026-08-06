# NORMALIZATION_LOG

Inconsistencies found across the 11 Macronome mockups and the canonical value
chosen for each. Goal: faithful reproduction of the mockup look, systematised —
**not** a redesign. Heuristic for "canonical": most recent + most frequent +
most internally coherent, unless noted.

Legend: **[CONFIRMED]** = the author decided · **[AUTO]** = trivial, auto-normalised.

---

## Headline

The base palette is identical across all 11 files (backgrounds, surfaces,
borders, `--accent`, `--ok`, `--nok`, `--focus`, radii, shadow, fonts). All real
divergence is confined to the items below. Note: `login.html` declares itself the
"design-token foundation", yet it is the file that drifts on `--ok-soft`,
`--nok-soft`, and `--tap`; the canonical source of truth is therefore the token
set in this folder, not any single mockup.

---

## Decisions requiring author input

### 1. Appbar global controls (theme / language) — [CONFIRMED → A]

- **Divergence:** `login.html` top-bar = FR/EN + theme and claims "mandatory on
  every screen"; app screens = theme toggle only, no language; `settings.html`
  and `account.html` = no theme toggle in the appbar at all.
- **Canonical:** appbar carries the **theme segmented toggle only, on every
  screen** (added to settings/account, which lacked it). **Language lives only in
  Paramètres.** `login.html` keeps its own FR/EN + theme (pre-auth surface).
- See `components/top-nav.md`, `theming.md`.

### 2. OK/NOK soft fills — [CONFIRMED → A]

- **Divergence (dark / light):**
  `--ok-soft` login `#12281d`/`#e2f1e8` vs app `#15301f`/`#dcefe3`;
  `--nok-soft` login `#2b1512`/`#f7e3de` vs app `#341812`/`#f5ddd6`.
- **Canonical = the app-screen values** (`#15301f` / `#341812`, light
  `#dcefe3` / `#f5ddd6`). Rationale: where the colour does real work (verdict
  badge on Repas, OK/NOK pills on Journal) over login's single rare alert.

### 3. Touch target `--tap` — [CONFIRMED → C]

- **Divergence:** login `44px` vs meals/food-db `40px`.
- **Canonical = two values:** `--tap: 40px` by default (desktop/mouse density),
  raised to `44px` at the mobile breakpoint (`<= 760px`) for at-the-table use.
  Implemented in `tokens.css` via a media override.

### 4. Active nav-tab hover — [CONFIRMED → A]

- **Divergence:** variant A (`.nav a:not(.active):hover`, meals/recipe/food-db)
  leaves the active tab inert on hover; variant B (`.nav a:hover` then
  `.nav a.active`, 7 files) lets the active tab also take the grey hover fill
  over its accent — almost certainly unintended.
- **Canonical = variant A.** The accent-filled active tab does not react to
  hover. Classed as bug-fix, not redesign.

### 5. Repas deficit readout "constat" caption — [CONFIRMED → A] (B-038)

- **Divergence:** `meals.html` ends the burn/deficit readout with a faint literal
  word "constat"; the shipped app omits it.
- **Canonical = no caption.** The readout shows burn + deficit/surplus + kg/week
  only; the literal "constat" label is intentionally dropped (author: the word is
  mockup jargon). The block is **always rendered** (placeholder only when there is
  no body weight yet). See `DECISIONS.md` B-033/B-038, `components/metric-cards.md`.

### 6. Poids period table scroll box — [CONFIRMED → app diverges] (B-189)

- **Divergence:** `weight.html` (and the former `data-tables.md` mandate) wraps the
  15-column period table in a fixed-height self-contained scroll box
  (`.tblscroll`/`.tableWrap`: `max-height:420px; overflow:auto`, header pinned to the
  box top). The shipped app now renders the table in **normal page flow** with the
  standard **appbar-sticky** header (`top:var(--appbar-h)`, `z-index:var(--z-sticky-sub)`,
  the B-069 pattern).
- **Canonical = page flow + appbar-sticky header.** No inner vertical scroll box; the
  page scrolls (both axes) — on a narrow desktop window the wide table makes the page
  scroll sideways (a contained horizontal scroll and an appbar-sticky header can't
  coexist in one wrapper — owner-accepted). The mockup is intentionally not reworked.
  See `DECISIONS.md` B-186/B-189, `components/data-tables.md`.

---

## Auto-normalised (trivial) — [AUTO], no veto received

1. **Account menu.** `meals.html` used a `.popmenu` button with
   _Paramètres / Compte / Déconnexion_; 9 files use `details/.acct-pop` with
   _Compte · Cibles · Contenants · Paramètres · Déconnexion_.
   → Canonical = `acct-pop` set (majority + fixed by masterplan v1.9). meals
   realigned. See `components/top-nav.md`.
2. **`.btn` base font-size.** 13px (meals/recipe/food-db) vs 12.5px (6 files).
   → **13px** base.
3. **`.seg` segmented control.** login `bg-elev` / 34px vs app `bg-elev-2` /
   30px. → Canonical = app (30px, `bg-elev-2`); 34px becomes a `lg` size variant.
4. **`.line:hover` fill.** meals `bg-elev-2` vs recipe `bg-elev`. → `bg-elev-2`.
5. **Modal scrim.** `rgba(0,0,0,.55)` + `blur(3px)` (meals/food-db/recipe) vs no
   blur (weight/containers). → `.55` + `blur(3px)`. `cook-scrim` stays distinct
   (`.66`, full-screen takeover, no blur).
6. **Sparse alias tokens.** `--over`/`--under`/`--in-band`/`--delta-pos`/
   `--delta-neg` were defined only in login/meals but are semantically
   `nok`/`under`/`ok`. → Promoted to global semantic tokens. `--grain-opacity`
   (login) is a one-off page effect, not a system token.
7. **Meal line vs recipe line grids.** meals 9 cols (grip/name/qty/kcal/L/G/P/
   pin/del) vs recipe 8 cols (grip/name/qty/kcal/L/G/P/del). → **Not a conflict**:
   two instances of one line component with different column maps by need; shared
   tokens (row height, numeric fonts) unified. See `components/data-tables.md`.
8. **Modal widths.** 380 / 560 / 960 / full-screen → intentional size scale
   (`sm/md/lg/cook`), not a divergence. See `components/modals.md`.

---

## Presentation gap owned by 2b

- **Gap #7 (unrated rating).** `DECISIONS.md` resolves it: unrated → em-dash
  "—" with **no star widget**; `0`/Bof → the 3-star widget showing 0 filled.
  Visually distinct (dash vs empty-star control). Mapped in
  `components/rating-stars.md` (no longer deferred — DECISIONS.md present).

---

## Correction — the fonts were never delivered — [B-263]

The type families in `tokens.css` were normalised from mockups rendered on a machine that had the
designer's fonts. The **delivery step was never part of any milestone**: there is no `@font-face`,
no `.woff2` and no font link anywhere in `packages/web`. On every machine without those faces
installed — i.e. essentially all of them, Söhne being commercial — the stacks fell straight through
to `ui-monospace` / `system-ui`.

The fallbacks worked, which is exactly why nobody noticed: the app looked fine while the contract
described a brand typography **the product has never displayed**.

**Resolution (owner): system fonts, stated as such.** Self-hosting free substitutes (Space Mono +
Inter Tight) and providing licensed Söhne files were both declined. The stacks are reordered so the
family that actually renders leads, with the named faces kept at the tail as an opportunistic
upgrade — no visual change whatsoever, since that is already what every machine shows. See
`tokens.md` §Type families.
