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

---

## Auto-normalised (trivial) — [AUTO], no veto received

1. **Account menu.** `meals.html` used a `.popmenu` button with
   *Paramètres / Compte / Déconnexion*; 9 files use `details/.acct-pop` with
   *Compte · Cibles · Contenants · Paramètres · Déconnexion*.
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
