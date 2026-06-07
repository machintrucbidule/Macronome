# Form inputs, selects, controls & autocomplete

## Text / number input (canonical)

`background:var(--bg-field); border:1px solid var(--border);
border-radius:var(--r-md); color:var(--text); --font-body; padding:0 11–14px`.
Numeric inputs use `--font-num`, usually `text-align:right`. Height: `--tap` for
form-primary fields (login, leftover modal), `34–36px` for compact rows.

- **focus**: `border-color:var(--focus)` (emphasised variant adds the 3px focus
  ring — login, checkbox).
- **invalid** (`aria-invalid`): `border-color:var(--nok)` + `box-shadow 0 0 0 3px
color-mix(... nok 20% ...)`.
- **placeholder**: `color:var(--text-faint)`.
- **disabled/locked** (e.g. login lockout): `opacity:.5; pointer-events:none`.
- **with suffix** (`.with-suffix`/`.inp .sfx`/`.usfx`): absolutely-positioned
  unit (`kcal`,`g`,`kg`,`g/kg`,`cm`) in `--font-num; --fs-11–12; --text-faint`;
  input gets right padding to clear it.
- **stepper** (B-006): number inputs carry a **custom stacked ▲▼ stepper** pinned
  **inside the field box** at the far right, **after** the unit → layout reads
  `value · unit · ▲▼`. The native browser spinner is hidden (it anchors to the digit,
  so it cannot render that order). Two borderless arrow buttons stacked vertically
  (▲ top / ▼ bottom), `~20px` column, 1px `--border` left divider, glyph `--text-faint`,
  hover `--accent`; each click applies the field's `step` honouring `min`/`max`. The input
  stays the labelled control (keyboard ↑/↓ unchanged); the buttons are `aria-hidden`.
- **label**: `--font-num; --fs-10–11; uppercase; ls .05–.1em; color:var(--text-dim)`;
  optional `.hintlabel`/`.opt` in `--text-faint`, non-uppercase, for "(optionnel)".
- **arithmetic expression** (B-108): the **quantity** inputs (Repas food qty + recipe
  ingredient qty only — not weight/measurement fields) accept a calculation typed in the
  field (`+ - * / ( )` + decimals, French comma). It is **evaluated on commit** (Enter/blur/
  Tab/arrow), and the **result replaces the expression** (no formula kept), e.g. `950/2` →
  `475`. An **invalid** expression is **rejected** (the previous value is kept). Parsing is a
  safe local evaluator — never `eval`; the field still submits a plain number (rule 2 intact).

## Textarea

Same field styling; `resize:vertical; min-height:54–120px; line-height:1.5;
--font-body`.

## Select (`<select>`)

Field styling; `--font-num`. Small inline variant (`.act-select`) at `--fs-11`
on `--bg-elev-2`. Activity multiplier, container/tare picker, diet flag.

## Checkbox (custom box)

Hidden native input + `.box`: `18px; border-radius:var(--r-sm); border:1.5px
solid var(--border-strong); background:var(--bg-field)`. Checked: `background/
border → var(--accent)`; check `svg` (`--accent-ink`) fades+scales in. Focus-
visible: focus ring. Leftover-modal row checkboxes use native with
`accent-color:var(--accent)`.

## Segmented / toggle controls

See foundations `.seg`. Also `.toggle`, `.visseg`, `.rangeseg`, `.yearseg`,
`.typefilter` — all the same pattern: `inline-flex; border:1px solid var(--border);
border-radius:var(--r-md); overflow:hidden`; buttons borderless on `--bg-field`
(or `--bg-elev-2`), selected → `--accent`/`--accent-ink`. `--font-num; --fs-11–12`.

## Chips (filter)

`--font-num; --fs-11; border:1px solid var(--border); background:var(--bg-field);
color:var(--text-dim); border-radius:var(--r-pill); padding:5px 10px; cursor:pointer`.
Selected (`aria-pressed`): `border-color:var(--accent); color:var(--accent);
background: color-mix(in srgb, var(--accent) 12%, transparent)`. (Rating-minimum
and visibility filters.)

## Stepper (recipe servings)

A distinct **horizontal − / +** stepper (not the stacked ▲▼ on number inputs above):
`inline-flex; border:1px solid var(--border); border-radius:var(--r-md);
background:var(--bg-field)`. − / + buttons (`28×32px`, hover `--accent`) flank a
centred `--font-num` input (`width 42px`).

## Search field

`position:relative`; input `height:var(--control-h-md)` (36px), left-padded 32px
for an inset magnifier `svg` (`16px; --text-faint; left:10px; top:9px`).
Placeholder notes accent-insensitivity ("insensible aux accents").

## Autocomplete dropdown (food/recipe search) `.ac`

`position:absolute; z-index:var(--z-autocomplete); background:var(--bg-elev-2);
border:1px solid var(--border-strong); border-radius:var(--r-md);
box-shadow:var(--shadow); max-height:240–300px; overflow:auto; min-width:260–280px`.

- **item** `.item`: grid `1fr auto`; name (`--fs-12.5`) + meta (`--font-num;
--fs-10; --text-faint`, e.g. `121 kcal /100g`). Match highlight `em` →
  `color:var(--accent); font-style:normal`.
- **states**: hover/highlighted `.hi` → `background: color-mix(... accent 14% ...)`;
  current `.cur` → 1px accent outline; **disabled** `.disabled` (would create a
  recipe cycle) → `opacity:.4; cursor:not-allowed`; **empty** `.empty` →
  "Aucun résultat" in `--text-faint`.
- **tags**: a `portion` tag and a `recette` (`--recipe`) badge can appear inline.
- A trailing **custom option** `.custom-opt` (`color:var(--accent)`) → "+ Valeurs
  manuelles (custom)…" opens the custom-food modal.
- Keyboard: ↑/↓ move `.hi`, Enter selects, Esc closes; Tab navigates the grid.

## Inline editable cells

Day comment, food name (recipe header), Journal comment: transparent field that
shows a `--border` on hover and `--focus` + `--bg-field` on focus — reads as
text until engaged.

## States (forms overall)

default · hover · focus · invalid · disabled/locked · with-suffix · loading
(skeleton field). Touch targets honour `--tap` (40→44 mobile).
