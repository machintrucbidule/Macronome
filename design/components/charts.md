# Charts — weight (EMA + trajectory) and stats (heatmap, bars)

All charts are inline **SVG**, `width:100%; height:auto`, `viewBox`-scaled,
`preserveAspectRatio="xMidYMid meet"`. **All strokes/fills reference theme
tokens** (never baked hex) — critical for the trend line (see theming.md).

## Shared chart primitives

- **Gridlines** `.gridline`: `stroke:var(--grid); stroke-width:1`.
- **Axis labels** `.axislbl`: `--font-num; --fs-10; fill:var(--text-faint)`.
- **Tooltips (B-056, extended SC-1/B-111, refined CT-1/B-140):** **all** chart hovers —
  the **weight chart**, the **two Stats bar charts** (OK/NOK stacked + avg kcal/month) and
  the **assiduité heatmap** — use the same **styled HTML tooltip** (the native SVG `<title>`
  is retired). It is a floating card (`--bg-elev-2`, `--border`, `--r-md`, shadow,
  `--font-num`) anchored to the hovered point/column/cell. The card (CT-1/B-140):
  - **Layout** — a **centered title line** (`--text`, `--fw-bold`, `--fs-12`) followed by
    **one value per line** (`--text-dim`, `--fs-11`, tabular numerals); no `·` separators
    inside the card.
  - **Content** — title = a **full, readable date**: a weigh-in day reads `10 juin 2026`
    (`formatDate`), a month column reads `Février 2026` (capitalized `month YYYY`), a heatmap
    cell reads its full date. Rows are **self-describing**: weight `78.5 kg` / waist `85 cm`;
    OK/NOK bars list all three shares with their count + percentage (B-169) — `16 (52%) jours OK`
    / `3 (10%) jours NOK (déficit)` / `12 (39%) jours NOK (surplus)` (percentages over the month's
    logged days); avg-kcal bars `Moyenne des jours OK : 1800
kcal` / `… NOK : 1950 kcal` / `Moyenne globale : 1875 kcal` (OK/NOK lines omitted when the
    month has no such day); heatmap `1600 kcal` (when logged) + status (`OK`/`NOK`/`non saisi`).
  - **Caret** — a small triangle on the card edge pointing at the hovered point, matching
    the card fill + `--border`; on the **bottom** edge by default (card above the point),
    moved to the **top** edge when the card flips below, and kept aligned with the anchor
    after a horizontal clamp.
  - **Positioning** — the card is **portaled to `<body>` and `position:fixed`** at the
    hovered point's client coords, so it **escapes the horizontal-scroll/overflow wrappers**
    (mobile) and **flips/clamps to stay fully within the viewport**: defaults above the
    anchor, **flips below** near the top edge, **shifts horizontally** near the left/right
    edges; never clipped, on desktop and mobile.
  - **Entrance** — a subtle fade + 2px rise (~120ms), **frozen** under
    `prefers-reduced-motion`.
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
Fill: `var(--ok)` (jour OK), `var(--warn)` (jour NOK en déficit), `var(--nok)` (jour NOK en
surplus / dépense inconnue), `var(--none)` (non saisi). The NOK cell splits orange/red by the
day's expenditure (B-167, same rule as the verdict badge B-166; `status` = `NOK_under` →
`--warn`, `NOK_over` → `--nok`). Weekday labels (every other) + month labels in `.axislbl`.
Hovering a cell surfaces the shared styled tooltip (§Shared primitives — full date + kcal +
status), not a native `<title>`. Legend: OK / NOK déficit / NOK surplus / Non saisi swatches
(11px, `rx:2`).
Key figures `.keyfigs`: inline `.kf` blocks (label `--fs-10` + value
`--font-num; --fw-bold; --fs-18`).

## Stats bars

- **Monthly OK/NOK stacked bars** (`viewBox 740×200`): a **3-segment** stack (B-167) —
  OK segment `var(--ok)` (bottom), NOK-déficit `var(--warn)` (middle), NOK-surplus `var(--nok)`
  (top), `rx:1`; month label below. The two NOK segments come from `nok_under_count` /
  `nok_over_count`; `ok_count` segment unchanged. **Only the OK% is labelled** (it is the OK-days
  share): drawn **inside the top of the green segment** (`fill:var(--bg)` ink for contrast) when that
  segment is tall enough, otherwise **above the bar** as before (B-169). The NOK shares are not
  labelled on the bar (only in the tooltip).
- **Avg kcal/month grouped bars** (`viewBox 740×230`): OK bar `var(--ok)`, NOK
  bar `var(--nok)`; a **target zone** band `fill: color-mix(in srgb, var(--accent)
16%, transparent)` drawn **per month** (one rect spanning each month's column, from that
  month's own `target_zone`), so the band **steps** across target changes and a month is
  omitted when it has no band (CZ-1/B-141); a **global average** polyline + dots in
  `var(--text)`.
- **Axes (SC-1/B-112):** both Stats bar charts draw a **left value axis** (`.axislbl` —
  day count for the OK/NOK chart, kcal for the avg-kcal chart) with **horizontal
  gridlines** (`.gridline`), plus the existing month labels along the bottom.
- **Legend (SC-1/B-112):** a `.legend` below each chart — OK/NOK chart: OK · NOK déficit
  (`--warn`) · NOK surplus (`--nok`) (B-167); avg-kcal chart: OK · NOK · Moyenne globale (line,
  `--text`) · Zone cible (`--accent`) (unchanged — out of B-167 scope).
- **Signals** `.signals`: responsive grid of `.sig` cards (`--bg-elev-2`,
  `--r-md`); a status dot — `.ok→--ok`, `.warn→--nok`, `.info→--under` — + text
  `--fs-12.5`.

## States

default · hover(tooltip) · empty (no logged days / no weigh-ins → prompt, see
states.md) · partial (future/unlogged cells rendered as `--none`) · single
weigh-in (Poids degrades gracefully to ≥2-point fallback) · waist on/off (Poids).
