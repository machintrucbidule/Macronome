# Charts — weight (EMA + trajectory) and stats (heatmap, bars)

All charts are inline **SVG**, `width:100%; height:auto`, `viewBox`-scaled,
`preserveAspectRatio="xMidYMid meet"`. **All strokes/fills reference theme
tokens** (never baked hex) — critical for the trend line (see theming.md).

## Shared chart primitives

- **Gridlines** `.gridline`: `stroke:var(--grid); stroke-width:1`.
- **Axis labels** `.axislbl`: `--font-num; --fs-10; fill:var(--text-faint)`.
- **Tooltips**: native SVG `<title>` per point/cell (date · value · status) — used by
  the heatmap. **Exception (B-056, extended SC-1/B-111):** the **weight chart** and the
  **two Stats bar charts** (OK/NOK stacked + avg kcal/month) use a **styled HTML
  tooltip** instead — a floating card (`--bg-elev-2`, `--border`, `--r-md`, shadow,
  `--font-num`/`--fs-11`) anchored to the hovered point/column, content `date · value`
  (bars: a per-month summary). The dense heatmap keeps the native `<title>`.
- **Legend** `.legend`: `--font-num; --fs-11; color:var(--text-dim)`; swatches —
  line `i` (`border-top:2px solid currentColor`), dashed `i.dash`
  (`border-top:2px dashed`), dot `i.dot` (8px circle). Colour set inline per
  series via the series token.

## Weight chart (Poids)

A single SVG, layered back-to-front:

1. **Goal line** — horizontal dashed `stroke:var(--ok); dasharray 6 5; opacity .9`.
2. **Target trajectory** — broken/dashed polyline `stroke:var(--traj);
stroke-width:1.8; dasharray 5 4; opacity .9` (per-period diet-flag driven).
3. **Raw weighed line** — thin polyline `stroke:var(--weight); stroke-width:1;
opacity .35`.
4. **EMA trend** — bold polyline `stroke:var(--trend); stroke-width:2.4` (the
   hero series; α=0.35, seeded at first weigh-in — DECISIONS Gap #9).
5. **Weighed-point dots** `.pt` — `fill:var(--weight); r:2.6`; hover surfaces the
   styled tooltip (B-056) via transparent hit-areas (the dots are intentionally tiny).
6. **Waist overlay** (optional, `showWaist`) — polyline + dots in `--waistc`,
   `r:2`; adds a right-hand axis (labels in `--waistc`).
   Legend series: Poids pesé (dot, `--weight`) · Tendance lissée (line, `--trend`) ·
   Trajectoire cible (dash, `--traj`) · Objectif (dash, `--ok`) · Tour de taille
   (line, `--waistc`, shown only when enabled).
   Range control: `.rangeseg` segmented (3 mois / 6 mois / 1 an / Tout).

## Cartouche (Poids stat tiles)

`.cartouche` grid `repeat(5,1fr)` (→ 2-up ≤900). `.stat`: `--bg-elev`,
`--r-lg`, padding 13/15. Label `.l` (`--font-num; --fs-10; uppercase; --text-faint`),
value `.v` (`--font-num; --fw-bold; --fs-24`, unit `.u` `--fs-12; --text-dim`),
delta `.d` (`--fs-11`): `.down → var(--ok)`, `.up → var(--nok)`, `.dim →
var(--text-faint)`.

## Stats heatmap (assiduité)

Calendar heatmap (`viewBox 0 0 740 130`). Cells `.hm-cell`: `12px` squares,
`rx:2`, `2px` gap, `stroke:var(--bg-elev)` (the inter-cell gutter — theme-correct).
Fill: `var(--ok)` (jour OK), `var(--nok)` (jour NOK), `var(--none)` (non saisi).
Weekday labels (every other) + month labels in `.axislbl`. Tooltip per cell.
Legend: OK / NOK / Non saisi swatches (11px, `rx:2`).
Key figures `.keyfigs`: inline `.kf` blocks (label `--fs-10` + value
`--font-num; --fw-bold; --fs-18`).

## Stats bars

- **Monthly OK/NOK stacked bars** (`viewBox 740×200`): OK segment `var(--ok)`,
  NOK `var(--nok)`, `rx:1`; % label above; month label below.
- **Avg kcal/month grouped bars** (`viewBox 740×230`): OK bar `var(--ok)`, NOK
  bar `var(--nok)`; a **target zone** band `fill: color-mix(in srgb, var(--accent)
16%, transparent)` drawn **per month** (one rect spanning each month's column, from that
  month's own `target_zone`), so the band **steps** across target changes and a month is
  omitted when it has no band (CZ-1/B-141); a **global average** polyline + dots in
  `var(--text)`.
- **Axes (SC-1/B-112):** both Stats bar charts draw a **left value axis** (`.axislbl` —
  day count for the OK/NOK chart, kcal for the avg-kcal chart) with **horizontal
  gridlines** (`.gridline`), plus the existing month labels along the bottom.
- **Legend (SC-1/B-112):** a `.legend` below each chart — OK/NOK chart: OK · NOK; avg-kcal
  chart: OK · NOK · Moyenne globale (line, `--text`) · Zone cible (`--accent`).
- **Signals** `.signals`: responsive grid of `.sig` cards (`--bg-elev-2`,
  `--r-md`); a status dot — `.ok→--ok`, `.warn→--nok`, `.info→--under` — + text
  `--fs-12.5`.

## States

default · hover(tooltip) · empty (no logged days / no weigh-ins → prompt, see
states.md) · partial (future/unlogged cells rendered as `--none`) · single
weigh-in (Poids degrades gracefully to ≥2-point fallback) · waist on/off (Poids).
