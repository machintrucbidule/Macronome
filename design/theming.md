# Theming & i18n notes

## 1. Theme strategy (dark default, light opt-in)

**Mechanism.** A single attribute on the document root drives everything:
`<html data-theme="dark|light">`. `tokens.css` defines all semantic colours
twice — once under `:root, [data-theme="dark"]`, once under
`[data-theme="light"]`. Every component consumes **semantic** variables
(`--bg`, `--text`, `--accent`, `--ok`…), never raw hex, so a theme switch is a
single attribute change with zero per-component work.

**Resolution (three settings, two rendered themes).** Paramètres offers
`Système · Clair · Sombre`:

- `dark` → `data-theme="dark"`.
- `light` → `data-theme="light"`.
- `système` → resolve at runtime from `prefers-color-scheme` (light → light,
  otherwise dark) and re-resolve on OS change. Persisted value is the _mode_
  (`system|light|dark`), not the resolved theme. Default mode = `dark`
  (masterplan §6).

**Cross-fade.** `body` transitions `background` and `color` over `--dur-theme`
(.35s, `--ease`). Avoid transitioning every element (only the body-level
surfaces need it); borders/text inherit instantly via inheritance + the body
fade reads as a global cross-fade.

> This used to be the app's **only** cross-cutting motion rule, and it is a restriction —
> it says what not to do, never what should move. **`components/motion.md` is now the
> authority** on that (B-253): what animates, what never does, the duration ladder, the
> touch rule and the single reduced-motion layer. The paragraph above remains the
> theme-switch case of it.

**Where the control lives (CONFIRMED ①A).**

- **Appbar:** the theme **segmented toggle only**, on **every** in-app screen
  (incl. Paramètres and Compte, which the mockups omitted it from). 2-button
  segmented: `●` dark / `○` light. The appbar control is the binary
  dark/light; the tri-state `Système/Clair/Sombre` lives in Paramètres.
- **Language:** **not** in the appbar. FR/EN lives only in Paramètres.
- **Login** is the one exception: being pre-auth, it keeps its own top-bar with
  both FR/EN and the theme toggle.

**Light-theme provenance.** Light was fully defined in the mockups (it is not
derived/guessed): every screen ships a complete `[data-theme="light"]` block and
they agree (after reconciling `--ok-soft`/`--nok-soft` to the app values per
NORMALIZATION_LOG #2). No derivation needed.

**Chart caveat.** Chart series tokens (`--trend`, `--weight`, `--traj`,
`--waistc`, `--grid`, `--none`) are themed too. `--trend` flips from near-white
(`#e8ebef`) in dark to near-black (`#1b1d20`) in light — SVG strokes must
reference the variable, not a baked colour, or the EMA line vanishes on light.
Heatmap cells use `stroke: var(--bg-elev)` as the inter-cell gap; that is theme-
correct as-is.

## 2. i18n (FR ⇄ EN) — text-expansion considerations

Bilingual FR/EN; FR is the source language and the longer one in most UI
strings. Build for the **longer** of the two and let the shorter reflow.

**General rule.** No fixed-width text containers. Controls size to content
(`padding`-based), labels wrap or truncate with ellipsis — never clip.

**Known expansion risks (flag for the build):**

- **Nav tabs** (`Repas · Journal · Poids · Aliments · Recettes · Stats`). EN
  (`Meals · Log · Weight · Foods · Recipes · Stats`) is comparable; the row is
  already `display:flex; gap:2px` and hides under `lg`. Safe, but keep tabs
  auto-width, no fixed px.
- **Verdict / status words.** `DANS LA CIBLE` (12 chars) vs `IN TARGET` /
  `WITHIN BAND`; `DÉPASSÉ` vs `OVER`; `SOUS` vs `UNDER`. These sit in the metric
  card `.c-status` (right-aligned, `margin-left:auto`). Already flexible; ensure
  the card can take the longest string without pushing the value — reserve the
  status on its own baseline row, allow wrap.
- **Activity labels.** `Extrêmement actif` / `Très actif` are long; they appear
  in a `<select>` and in Journal chips (`.actchip`, auto-width). Keep the select
  full-width in its row; chips must not be fixed-width.
- **Section/uppercase labels.** FR `Structure de journée par défaut`,
  `Cibles macro calculées`. They live in headers/`.sect` with wrapping allowed.
  Do not set `white-space:nowrap` on these.
- **Buttons.** `Se déconnecter` / `Sign out`, `+ Ajouter un aliment` /
  `+ Add a food`. Buttons are padding-sized; fine. Avoid icon-only buttons that
  rely on a fixed width.
- **Login alerts.** `Trop de tentatives. Réessayez dans 30 s.` vs `Too many
attempts. Try again in 30 s.` Banner is full-width, `line-height:1.4`, wraps.
  Keep the countdown number (`--font-num`) as a separate inline token so only the
  digit updates.
- **Tooltips/hints** (`.hint`, `.row .lab .d`) are the longest FR strings; they
  already wrap with `max-width` ~430px and `line-height:1.45`. Keep max-width,
  never `nowrap`.

**Numbers & dates.** Decimal comma in FR (`74,3 kg`), point in EN; thousands and
units localise. All numeric rendering uses `--font-num` tabular figures so
column widths stay stable across locales. Date formatting is locale-driven
(`fr-FR` long form `mardi 30 mai 2026`; EN equivalent), so the date label must be
free-width.

**Hard fixed-width spots to audit (potential breakage):**

- Meal-log column grid (`74px` qty, `26px` macro columns in meals): macro
  headers are single letters (`L/G/P`) in both languages — safe. Quantity unit
  chips (`œuf`, `vaporisation`) can be long; the unit chip already has
  `max-width:54px; text-overflow:ellipsis` — keep it.
- Cartouche/metric tiles use fixed grid fractions; values are numeric, labels
  short and uppercase — low risk, but allow label wrap to 2 lines.
