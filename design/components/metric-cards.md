# Metric cards — calories + macros with target indicator

The day-summary cluster on Repas: one wide **Calories** card + three **macro**
cards (Lipides/Glucides/Protéines), all one family, plus the verdict cluster.

## Layout

`.totals` grid: `1.5fr 1fr 1fr 1fr auto` (kcal wider; last col = verdict).
At `lg`(≤900) → `1fr 1fr 1fr` with kcal and verdict spanning full width; at
`sm`(≤520) → `1fr 1fr`.

## Card anatomy `.card`

`border:1px solid var(--border); border-radius:var(--r-md);
background:var(--bg-elev); padding:9px 12px; flex column; gap:7px`.

- **c-top**: label (`--font-num; --fs-11; uppercase; ls .05em; color:var(--text)`)
  - threshold text (`.c-thr`, `--fs-10; color:var(--text-faint)`,
    e.g. `cible 1550–1650`, `min. 50 g`, `max. 150 g`).
- **c-bar**: the target indicator (below).
- **c-bot**: value (`.c-val`, `--font-num; --fw-bold; --fs-16`) + status
  (`.c-status`, `--font-num; --fs-10; --fw-bold; uppercase; ls .06em;
margin-left:auto`).

**Calories card `.card.kcal`** is emphasised: `background:var(--bg-elev-2);
border-color:var(--border-strong)`; `.c-val` at `--fs-24`.

## Target indicator (the band / floor / ceiling bar)

A 9px-tall rounded track (`.c-bar`, `border-radius:var(--r-pill); overflow:hidden`)
with a coloured zone gradient, a `.fill` showing current value, and threshold marks.

**Threshold marker (notch).** Each target threshold is marked by a **notch** cut
into the bar rather than a line drawn over it: a thin vertical sliver
(~3px wide, full bar height) coloured with the **card background** (`var(--bg-elev)`,
or `var(--bg-elev-2)` on the emphasised calorie card) so it reads as a gap in the
track, flanked by a 1px `var(--border-strong)` edge for definition. This stays
legible over **any** zone/fill colour — including the light-green `--ok` floor fill
where the former white tick was nearly invisible (B-044). The notch sits **above**
the `.fill` (the fill never paints over it).

Three modes:

- **Band (calories)** — three zones via `linear-gradient`: under-zone
  `color-mix(--under 22%)`, in-band `color-mix(--ok 24%)`, over-zone
  `color-mix(--over 22%)`. Two notches (`.t1`,`.t2`) mark min/max. `.fill` colour =
  `--in-band` if within, `--under` if below, `--over` if above. Scale: top of bar =
  `max × 1.3`.
- **Floor (protein, fat)** — two zones: below-floor `color-mix(--nok 22%)`,
  above `color-mix(--ok 22%)`; one notch at the floor. OK when `value ≥ floor`.
- **Ceiling (carbs)** — two zones: under-ceiling `color-mix(--ok 22%)`, over
  `color-mix(--nok 22%)`; one notch at the ceiling. OK when `value ≤ ceiling`.

## Domain states

- **good** (`.card.good`): `.c-status` → `--ok`. Status text: **`OK`** for any
  in-target value — calorie band **and** macro floor/ceiling (B-037, unified
  wording; was `DANS LA CIBLE` on the band card). EN: `OK`.
- **bad** (`.card.bad`): `.c-status` and (for macros) `.c-val` → `--nok`. Status
  text: **`DÉPASSÉ`** for any over-target value (calorie over-band and macro
  ceiling exceeded), **`EN-DESSOUS`** for any under-target value where that is bad
  (macro floor not met) (B-037; was `AU-DESSUS`/`DÉPASSÉ`/`SOUS`). EN: `Over` /
  `Below`.
- **under, calories only** (`.card.kcal.under`): `.c-status` and `.c-val` →
  `--under` (below band is informational blue, not red). Status text: **`EN-DESSOUS`**
  (B-037; was `SOUS`). EN: `Below`.
- **negative carb ceiling** (carb ceiling ≤ 0): show the **real** value + the
  inconsistency warning — not clamped. See `toasts-warnings.md`.

## Verdict cluster (right cell)

`.verdict` column, right-aligned, `min-width:150px`:

- **Activity select** (`.act-wrap` + `.act-select`): a tiny labelled `<select>`
  (`--font-num; --fs-11; bg-elev-2`), per-day activity multiplier.
- **OK/NOK badge** — see `badges-verdict.md`.
- **Deficit readout** (`.constat`): `--font-num; --fs-10; color:var(--text-faint);
right-aligned; line-height:1.55`. Burn + deficit/surplus + kg/week; `.def.neg` →
  `--ok`, `.def.pos` → `--nok` (deficit reads negative/green, surplus red). **Always
  rendered** (activity is always set — default sedentary); shows a short placeholder
  only when the account has no body weight yet. The mockup's literal "constat" caption
  is intentionally omitted (NORMALIZATION_LOG #5, DECISIONS B-033/B-038).

## Loading

Skeleton: greyed totals row + skeleton macro columns (see `states.md`).
