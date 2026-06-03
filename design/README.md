# Macronome — Design System (visual contract)

Framework-agnostic visual contract extracted from the 11 mockups, reconciled per
`NORMALIZATION_LOG.md`. **No application/React code** — this defines *what* to
build, not *how*. The logical contract (schema/API/calculations) is owned by 2b.

## Files
- `NORMALIZATION_LOG.md` — every inconsistency → canonical choice (A).
- `tokens.css` — authoritative tokens: colours (dark default + light),
  type/spacing/radii/sizing/borders/motion, z-index layers, `--tap` responsive
  override (B).
- `tokens.md` — scales reference + usage map (type, spacing, breakpoints,
  z-index, motion).
- `theming.md` — dark/light strategy + FR⇄EN text-expansion notes (D).
- `components/` — per-component visual specs: anatomy · tokens consumed · states
  (C).

## Component index
- `00-foundations.md` — surfaces, focus ring, brand tick, scrim, segmented
  control, pills, icon buttons.
- `top-nav.md` — appbar + primary nav + account menu.
- `buttons.md` — primary / ghost / danger / secondary, submit+spinner.
- `metric-cards.md` — calorie + macro cards, target band/floor/ceiling indicator,
  verdict cluster.
- `rating-stars.md` — 0–3 stars, Bof(0) vs unrated(—) (Gap #7).
- `badges-verdict.md` — OK/NOK badge + override menu; Journal pill.
- `data-tables.md` — dense tables + meal/recipe line grids + qty/unit cell.
- `forms-inputs.md` — inputs, selects, checkbox, segmented, chips, stepper,
  search, autocomplete dropdown, inline-edit.
- `modals.md` — size scale, leftover-proration, custom food, food add/edit,
  cook-mode takeover.
- `toasts-warnings.md` — block-and-warn, carb-ceiling inconsistency, dup-name,
  failure banner, toast.
- `charts.md` — weight (EMA + trajectory) + cartouche + stats heatmap/bars.
- `states.md` — empty, loading (skeleton), login error/lockout, disabled.

## Canonical decisions (from the inconsistency pass)
1. Appbar = theme toggle only on every screen; language in Paramètres.
2. OK/NOK soft fills = app-screen values.
3. `--tap` = 40px desktop, 44px ≤760px.
4. Active nav tab is inert on hover.
(Plus the auto-normalised batch — see `NORMALIZATION_LOG.md`.)
