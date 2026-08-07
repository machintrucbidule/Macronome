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
   Order (masterplan v1.9, **+ Conseils appended by B-311**): **Repas · Journal ·
   Poids · Aliments · Recettes · Stats · Conseils**.
3. **Right cluster** `.right` (`margin-left:auto; gap:8px`): theme **segmented
   toggle** (dark `●` / light `○`) + account button. (CONFIRMED ①A: theme toggle
   present on every screen incl. Paramètres/Compte; **no language toggle here** —
   language lives in Paramètres.)

**The nav list has one source** (B-311): `app/nav-items.ts` (`NAV_ITEMS` — route, i18n key,
icon key, plus the Repas `/` + `/day/:date` active override). The desktop `.nav` and the
mobile `BottomNav` both map it; neither hard-codes its own copy. Adding a primary route means
adding one entry there, and its glyph in `app/nav-icons.tsx` (see `bottom-nav.md`).

## Conseils has a nav slot, not an appbar icon — [B-311, supersedes B-202]

Conseils is the **last** primary nav entry, at every width: a text link in `.nav` on desktop,
the 7th tab of the bottom bar on mobile (`bottom-nav.md`). The **💡 lightbulb icon button that
used to sit in the `.right` cluster is removed** — this is a move, not a duplication.

B-202 had put the bulb on the bar and exempted it from every responsive hide, with one stated
justification: _"Conseils has no bottom-tab slot, so the lightbulb is its only entry point"_.
Giving Conseils a slot in both navigations removes that justification, so the exemption and the
bulb go together. The appbar keeps no always-on icon button; the right cluster is theme toggle +
avatar, and on mobile the avatar alone.

## Chrome text is not selectable — [B-258]

`.appbar` sets `user-select: none`, inherited by the brand, the wordmark, the mobile screen
title, the nav links and the right cluster. Dragging across the header used to paint a blue text
highlight — the clearest "this is a web page" tell in the installed window.

**The boundary is the whole point, and it is enumerated, never a blanket `*` rule.** Furniture:
the appbar, both navigations, the meal tabs, table **column headers**, and menu panels (their
labels inherit). Data stays selectable everywhere: food and recipe names, quantities, comments,
totals, dates, container names, and the deliberately `user-select: all` diagnostic codes on the
login and error screens. A data region that lives inside a marked container re-enables
`user-select: text` explicitly.

## Day-tone rule (under the title strip) — [B-262]

A **2px full-bleed rule** immediately below `.appbar`, carrying the **current day's** compliance
tone (`logic/day-snapshot-verdict.md §8b`, server-computed — the web never derives it):

| tone   | colour        | meaning                                     |
| ------ | ------------- | ------------------------------------------- |
| `ok`   | `var(--ok)`   | today is inside the calorie target          |
| `warn` | `var(--warn)` | outside the target but still under the burn |
| `nok`  | `var(--nok)`  | outside the target and over the burn        |
| `none` | transparent   | today carries no calories yet               |

- It always reflects **today** (the `effectiveDay` 03:00 rule), on **every** screen — it is a
  standing reminder, not a per-screen readout, so browsing a past day in Journal never repaints
  it. It therefore never contradicts the day badge: they answer different questions.
- **It must be out of the normal flow**: an absolutely positioned child of `.appbar`, pinned to its
  lower edge. `--appbar-h` is the sticky offset **shared** by the Repas day bar, the DataTable
  theads, ListChrome and Poids — a 2px block in the flow (or a second sticky element at the same
  offset) puts all of them 2px out of true, which reads as the Repas totals band jittering during
  scroll. Riding the already-sticky header also means it needs no sticky rule of its own, and no
  window-controls-overlay height override: it follows whatever height the strip takes.
- So in an installed **WCO** window it reads as the lower edge of the title strip, and in a browser
  tab as a band on the appbar's bottom edge. It is 2px at every width; on `none` it is
  **transparent**, leaving the header's ordinary 1px `--border` and nothing else — an unstarted day
  should not shout, and must look exactly as it did before this rule existed.
- **Decorative, not informative**: `aria-hidden`. The verdict is already available as text on
  Repas and Journal; a bare colour with no label would only add noise to a screen reader.
- No new token. `--ok`/`--warn`/`--nok`/`--border` in both themes.

## Nav link states — [CONFIRMED ④A]

- **default**: `--text-dim`.
- **hover (non-active only)**: `color:var(--text); background:var(--bg-elev-2)`.
  Rule must be `.nav a:not(.active):hover` — the active tab does **not** react to
  hover.
- **active**: `color:var(--accent-ink); background:var(--accent)` (filled pill).
- **Tightened between 561 and 900px — [B-311].** A
  `@media (min-width: 561px) and (max-width: 900px)` rule shrinks the `.nav` `gap` and the
  `.nav a` horizontal padding (nothing else — same font, same colours, same states), so the
  **seven** labels still fit beside the brand and the right cluster. **≥901px is untouched**,
  and ≤560px the nav is hidden and the bottom tab bar takes over (`bottom-nav.md`).
  This rule **replaces** the never-implemented "`.nav` hidden ≤900px" intention that stood here
  until B-311: the nav stays visible down to 561px, which is what the app has always done.

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
toggle** (spec §2.1; both move off the bar). Since B-311 there is nothing else to keep on the
bar — the Conseils lightbulb is gone and Conseils is the bottom bar's 7th tab — so the mobile
appbar reads: brand `.tick` + screen title + avatar. The avatar opens a **bottom sheet**
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
- **responsive (561–900px)**: `.nav` visible and **tightened** (see Nav link states).
- **responsive (≤560px)**: `.nav` and the theme toggle hidden; brand + screen title +
  avatar remain, and the primary routes live in the bottom tab bar.
