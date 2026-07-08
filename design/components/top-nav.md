# Top nav + account menu

The persistent header on every authenticated screen.

## Anatomy

`.appbar` — `display:flex; align-items:center; gap:14px; padding:10px
var(--page-gutter); border-bottom:1px solid var(--border);
background:var(--bg-elev); position:sticky; top:0; z-index:var(--z-appbar)`.
Sticky height ≈ `--appbar-h` (51px) — table headers stick at `top:51px`.

Left → right:

1. **Brand**: `.tick` + wordmark (see foundations).
2. **Primary nav** `.nav`: inline links, `--font-num`, `--fs-12`,
   `color:var(--text-dim)`, `padding:6px 10px; border-radius:var(--r-sm)`.
   Order (masterplan v1.9): **Repas · Journal · Poids · Aliments · Recettes ·
   Stats**.
3. **Right cluster** `.right` (`margin-left:auto; gap:8px`): theme **segmented
   toggle** (dark `●` / light `○`) + account button. (CONFIRMED ①A: theme
   toggle present on every screen incl. Paramètres/Compte; **no language toggle
   here** — language lives in Paramètres.)

## Nav link states — [CONFIRMED ④A]

- **default**: `--text-dim`.
- **hover (non-active only)**: `color:var(--text); background:var(--bg-elev-2)`.
  Rule must be `.nav a:not(.active):hover` — the active tab does **not** react to
  hover.
- **active**: `color:var(--accent-ink); background:var(--accent)` (filled pill).
- Hidden entirely at the `lg` breakpoint (≤900px); navigation then via account
  menu / back-affordances.

## Account menu — [AUTO-normalised to acct-pop]

Trigger: a circular avatar button, `--avatar` (32px), `border-radius:50%;
border:1px solid var(--border); background:var(--bg-elev-2); color:var(--text);
--font-num; --fs-12`, initials ("IV"). Open state: `border-color/color →
var(--accent)`.

Popover `.acct-pop`: `position:absolute; right:0; top:38px;
background:var(--bg-elev-2); border:1px solid var(--border-strong);
border-radius:var(--r-md); box-shadow:var(--shadow); min-width:172px; padding:5px;
z-index:var(--z-menu)`.

Items (canonical set, fixed by masterplan v1.9; "Compte" renamed "Mon compte"
by B-191; admin-conditional "Utilisateurs" added by B-192):
**Mon compte · Cibles · Contenants · Utilisateurs*ᵃᵈᵐⁱⁿ* · Paramètres** ·
`—`(divider `.sep`: 1px border, margin 5px 0) · **Se déconnecter** (`.logout`,
`color:var(--nok)`).
Item: `display:block; padding:8px 12px; --fs-13; border-radius:var(--r-sm)`;
hover `background: color-mix(in srgb, var(--accent) 14%, transparent)`.

**Conditional entries (B-192 pattern):** a menu item may carry an `adminOnly`
flag; both menu variants filter the shared link list on the session role
(`session.user.is_admin`) — no per-variant duplication, no positional slicing.
Visibility is presentation only: the route guard (redirect) and the API role
guard (403) are the real protections.

> meals.html's old `.popmenu` (button + Paramètres/Compte/Déconnexion only) is
> replaced by this. Implement the open/close as a click-toggled menu (the
> `details/summary` pattern or JS) — visual spec identical either way.

## Mobile account sheet (≤560px) — mobile-responsive S3

On the phone breakpoint the appbar hides the **primary nav** and the **theme segmented
toggle** (spec §2.1; both move off the bar). The avatar then opens a **bottom sheet**
(`Modal mobile="sheet"`, overlay taxonomy in `mobile.md` / `modals.md`) instead of the
`<details>` dropdown. The sheet holds, as comfortable `--tap` rows: the **theme toggle**
(moved out of the bar) + the canonical secondary destinations **Mon compte · Cibles ·
Contenants · Assistant IA · Intégrations · Utilisateurs*ᵃᵈᵐⁱⁿ* · Paramètres ·
À propos · Déconnexion**. Selected via a
`useIsMobile()` render-switch — **desktop (≥561px) keeps the exact `<details>` dropdown
above, untouched** (`AccountMenu.tsx`). See `bottom-nav.md` for the bottom tab bar that
carries the primary routes on mobile.

## States

- **default / open** (menu shown/hidden).
- **active route** reflected on the matching nav link.
- **responsive (≤900px)**: `.nav` hidden; brand + right cluster remain. Account
  menu is the fallback navigation surface.

> **Doc-accuracy flag (mobile-responsive S3, 2026-06-10):** the shipped
> `AppShell.module.css` has **no** ≤900px rule hiding `.nav` — the primary nav stays
> visible 561–900px today. The S3 mobile shell only hides `.nav` at **≤560px** (where it
> moves to the bottom tab bar), per spec §0 "no existing desktop-range breakpoint is
> modified". The ≤900px claim above is left as written (an unimplemented design
> intention); reconciling it is an owner decision, out of S3 scope.
