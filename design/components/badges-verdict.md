# OK/NOK verdict badge + override menu, and pills

The day's calorie verdict. Auto = calorie-only; clickable to force OK/NOK or
return to auto. Three render contexts, one semantic model.

## A. Repas badge `.badge` (clickable, with menu)

`--font-display; --fw-bold; --fs-15; padding:6px 14px; border-radius:var(--r-md);
ls .04em; display:flex; align-items:center; gap:7px; cursor:pointer`.
Hover: `filter:brightness(1.08)`.

- **ok**: `background:var(--ok-soft); color:var(--ok); border:1px solid
color-mix(in srgb, var(--ok) 45%, transparent)`.
- **nok**: `background:var(--nok-soft); color:var(--nok); border:1px solid
color-mix(... nok 45% ...)`.
- Sub-label `.auto`: `--font-num; --fs-9; uppercase; ls .08em; opacity .7` — reads
  `auto` or `forcé`.
- Caret `.caret`: `--fs-10; opacity .6` (▾) signalling the menu.
- **Uniform width (B-165):** on **desktop** (`min-width:561px`) the badge has a **fixed width**
  (`99.12px` — the measured natural `NOK · Auto · ▾` border-box width; px because the type scale is
  px-fixed; content centred) so every OK/NOK selector is
  the same width and the columns line up across **Journal + Repas**. On **mobile** (≤560px) the badge
  keeps **no fixed width**, so the Repas reduced rule (smaller padding/font, `A`/`F` sub-label) stands.

## B. Journal verdict chip `.verdict` (pill form)

`inline-flex; gap:5px; --font-num; --fs-11; --fw-bold; padding:3px 9px;
border-radius:var(--r-pill); cursor:pointer; border:1px solid transparent`.

- **ok**: `color:var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent)`.
- **nok**: `color:var(--nok); background: color-mix(... nok 14% ...)`.
- `.ovr` sub-tag (`--fs-9; opacity .8`) shows `forcé` when overridden.

## C. Override menu (context menu)

Shared menu primitive (`.unit-menu`/`.menu` styling): `position:absolute/fixed;
background:var(--bg-elev-2); border:1px solid var(--border-strong);
border-radius:var(--r-md); box-shadow:var(--shadow); z-index:var(--z-menu)`.
Items: **Forcer OK · Forcer NOK · Calcul auto (OK|NOK)**; current selection gets
`.cur` (`color:var(--accent)`); hover `background: color-mix(... accent 14% ...)`.
The menu **replaces** the legacy three override buttons (masterplan v2.0).

## States

- **auto-ok / auto-nok** — computed from the calorie band; badge shows value +
  `auto`.
- **override-active** — badge/chip shows forced value + `forcé`; the "Calcul
  auto" item annotates what auto _would_ be, e.g. `Calcul auto (OK)`.
- **hover / open** — brightness lift / menu open.

## D. Day-kind chip + menu (Repas date line, DK-1 / B-078)

Same clickable-badge-with-menu pattern as §A/§C, but it switches the **day kind**
(Complet ⟷ Partiel) rather than the verdict. It lives on the Repas date line, replacing
the inert day-type tag and the former "Passer en jour détaillé" banner.

- Chip `.kind` (clickable): a **compact** variant — it keeps its own small type (`--font-num;
  --fs-10; uppercase; ls .08em`) and tight horizontal padding (smaller than §A), but is **sized to
  §A's height** and uses the **`--r-md`** radius (not `--r-pill`) so the Complet/Partiel selector
  lines up with the OK/NOK badge on the day line (B-161). Colour-coded by current kind —
  **complet** `color:var(--ok); background:var(--ok-soft); border:1px solid
color-mix(in srgb, var(--ok) 45%, transparent)`; **partiel** uses the established
  Partiel/summary yellow `--accent` (the calendar partial dot colour): `color:var(--accent);
background: color-mix(in srgb, var(--accent) 16%, transparent); border:1px solid
color-mix(in srgb, var(--accent) 45%, transparent)`. Caret `.caret` as §A. **No new token.**
- Menu (shared `.menu` primitive, §C): two items — **Complet · Partiel**; the current kind
  gets `.cur`. Selecting **Complet** seeds meals (`POST /days/:date/detail`); selecting
  **Partiel** converts to summary (`POST /days/:date/summary`). When the day carries food
  (Σ > 0), choosing Partiel first raises a **strong confirm** (`modals.md`, foods discarded).
