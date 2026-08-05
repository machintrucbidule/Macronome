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
3. **Right cluster** `.right` (`margin-left:auto; gap:8px`): a **Conseils 💡
   lightbulb** icon button + theme **segmented toggle** (dark `●` / light `○`) +
   account button. (CONFIRMED ①A: theme toggle present on every screen incl.
   Paramètres/Compte; **no language toggle here** — language lives in Paramètres.)

## Conseils lightbulb (appbar icon button) — [B-202]

A **persistent icon button** in the `.right` cluster, **before** the theme toggle and the
account avatar: a **💡 lightbulb** that is a `NavLink` to **`/advices`** (the AI advice
page). It is the app's first always-on appbar icon (there is **no** shared `IconButton`
primitive yet — this establishes the appbar-icon pattern; the row-hover icon affordance of
`00-foundations.md` is a different, table-row pattern).

- Style: borderless, transparent background, `color:var(--text-dim)`; **hover / active-route**
  → `color:var(--accent)`; a `--tap` (40→44px) hit target, `border-radius:var(--r-sm)`, the
  glyph at `--fs-16`. `aria-label` "Conseils" (localised); `title` the same. Active-route
  emphasis mirrors the nav links (accent), but as a **tint** (no filled pill — it is an icon,
  not a text tab).
- **Visible on mobile too** (owner decision, B-202): **unlike** the primary nav and the theme
  toggle, the lightbulb is **exempt** from the ≤560px appbar hide (below) and from the ≤900px
  `.nav` hide — Conseils has no bottom-tab slot, so the lightbulb is its only entry point and
  must stay on the bar at every width. In the installed WCO window it inherits
  `app-region:no-drag` (it is interactive chrome), like the other right-cluster controls.

## Day-tone rule (under the title strip) — [B-262]

A **2px full-bleed rule** immediately below `.appbar`, carrying the **current day's** compliance
tone (`logic/day-snapshot-verdict.md §8b`, server-computed — the web never derives it):

| tone   | colour          | meaning                                     |
| ------ | --------------- | ------------------------------------------- |
| `ok`   | `var(--ok)`     | today is inside the calorie target          |
| `warn` | `var(--warn)`   | outside the target but still under the burn |
| `nok`  | `var(--nok)`    | outside the target and over the burn        |
| `none` | `var(--border)` | today carries no calories yet               |

- It always reflects **today** (the `effectiveDay` 03:00 rule), on **every** screen — it is a
  standing reminder, not a per-screen readout, so browsing a past day in Journal never repaints
  it. It therefore never contradicts the day badge: they answer different questions.
- It sits **inside** the sticky appbar's stacking context, directly after `</header>`, so in an
  installed **window-controls-overlay** window it reads as the lower edge of the title strip, and
  in a browser tab it degrades to a plain rule under the appbar. It is 2px at every width; on
  `none` it is indistinguishable from the existing `--border` bottom edge, which is the point —
  an unstarted day should not shout.
- **Decorative, not informative**: `aria-hidden`. The verdict is already available as text on
  Repas and Journal; a bare colour with no label would only add noise to a screen reader.
- No new token. `--ok`/`--warn`/`--nok`/`--border` in both themes.

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
background:var(--bg-elev-2); --font-num; --fs-12`, initials ("IV").
**Closed: `border-color:var(--accent); color:var(--accent)`** — the menu is the only way to
reach the secondary screens, so its opener carries the right cluster's colour anchor (B-242;
the neighbouring 💡 stays neutral-by-default). **Open: filled accent**
(`background:var(--accent); color:var(--accent-ink); border-color:var(--accent)`), the same
treatment as the active nav pill, so closed → open still reads as a state change. Both variants
(desktop `<details>`, mobile sheet) show both states.

Popover `.acct-pop`: `position:absolute; right:0; top:38px;
background:var(--bg-elev-2); border:1px solid var(--border-strong);
border-radius:var(--r-md); box-shadow:var(--shadow); min-width:172px; padding:5px;
z-index:var(--z-menu)`.

Items (canonical set, fixed by masterplan v1.9; "Compte" renamed "Mon compte"
by B-191; admin-conditional "Utilisateurs" added by B-192). **Grouped into three titled
blocks then a meta block (B-243)** — the seven destinations span three natures (identity,
reference data the user maintains, application configuration) and a flat list interleaved
them:

| Block heading     | Items                                                         |
| ----------------- | ------------------------------------------------------------- |
| **COMPTE**        | Mon compte · Utilisateurs*ᵃᵈᵐⁱⁿ*                              |
| **MES DONNÉES**   | Cibles · Contenants                                           |
| **CONFIGURATION** | Paramètres · Assistant IA · Intégrations                      |
| `—` (divider)     | À propos · **Se déconnecter** (`.logout`, `color:var(--nok)`) |

Block heading: the discreet small-caps header treatment already used for table/card headers —
`--font-num; --fs-10; uppercase; letter-spacing:var(--ls-caps); color:var(--text-faint)`, not
interactive. **A group whose items are all filtered out renders no heading** (see conditional
entries below). **One** divider only, before the meta block; À propos and Se déconnecter are
adjacent inside it. **No submenus** (B-243): the sole candidate was folding Assistant IA +
Intégrations under a "Connexions" entry, but the Assistant IA page was deliberately extracted
from Paramètres to be autonomous (B-130) — a titled block gives the same grouping at no
interaction cost.
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
toggle** (spec §2.1; both move off the bar) — but **keeps the Conseils 💡 lightbulb** (B-202),
its only entry point (see above). The avatar then opens a **bottom sheet**
(`Modal mobile="sheet"`, overlay taxonomy in `mobile.md` / `modals.md`) instead of the
`<details>` dropdown. The sheet holds, as comfortable `--tap` rows: the **theme toggle**
(moved out of the bar) + the canonical secondary destinations **in the same titled blocks as
the dropdown** (B-243 — COMPTE · MES DONNÉES · CONFIGURATION, then the meta block with
À propos · Déconnexion); same headings, same order, same empty-group rule. Selected via a
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
