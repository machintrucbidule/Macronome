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

**One shared primitive** (`components/Form/Textarea`), styled on the canonical text
field above: `background:var(--bg-field); border:var(--bw) solid var(--border);
border-radius:var(--r-md); color:var(--text); --font-body; --fs-13; padding:8px 12px;
line-height:1.5; resize:vertical; width:100%`, with a per-host `min-height` in place of
the input's fixed height. `:focus` → `border-color:var(--focus)`; `aria-invalid` → the
standard invalid ring; placeholder `--text-faint`. Every multi-line field goes through
it — no per-screen recipe.

- **`mono` variant** (`--font-num; --fs-12`): the Assistant IA **prompt** and
  **avoidances** fields, whose content is technical text.
- Hosts and their `min-height`: AI note fields (60px; two of the three carry a
  `maxLength` counter in `--font-num; --fs-10; --text-faint`), recipe **instructions**
  (88px), and the **macro-label paste** field (PM-1/B-114, parse-label sub-dialog,
  `modals.md`) at ~140px — a plain multi-line field the user pastes a nutrition table
  into, no dedicated variant.

## Select

**No native `<select>`.** A list field is the shared `SelectMenu` in its **field**
variant: the trigger takes the canonical text-field box (`height:36px; --font-body;
--fs-13; padding:0 12px; border:var(--bw) solid var(--border)`, full width) with a `▾`
caret in `--text-faint`; the panel is the menu surface (`--bg-elev-2`, `--border-strong`,
`--r-md`, `var(--shadow)`) and **flips above** the trigger when there is no room below
(same hook as the autocomplete). Disabled → `color:var(--text-faint);
cursor:not-allowed`. A **placeholder** renders in `--text-faint` when the current value
matches no option. Keyboard: ↑/↓ move the active option, Home/End jump to first/last,
Enter selects, Esc closes and **returns focus to the trigger**.

- **The panel is height-capped and scrolls.** `overflow-x:hidden; overflow-y:auto;
overscroll-behavior:contain`, with a `max-height` set **dynamically** to the room actually
  available on the side the flip chose (clamped 120–300px). This differs from the autocomplete
  on purpose: `.ac` keeps a **fixed** ceiling and never shrinks, because its host cell is
  predictable; a list field can sit anywhere — mid-modal, in a card — and its option count can
  be user data (the leftover tare catalog, the fetched AI model list), so flipping alone only
  picks the less-bad side and the list still gets cut off. `contain` keeps the wheel inside the
  list instead of chaining to the modal and the page behind.
- A card hosting a list field must **not** clip it: `overflow:hidden` on a card clips _without_
  scrolling, so whatever falls outside is unreachable. Such cards carry the `flow` modifier
  (`overflow:visible`), the same escape hatch the garde-manger card already uses.

Small inline **badge** variant (the original: `--font-num; --fs-11` on `--bg-elev-2`) —
activity multiplier, rating dropdown, cross-meal move picker.

Field hosts: sex (first-run wizard + Compte), Home Assistant rounding decimals,
Assistant IA model, leftover container/tare.

## Checkbox

**Native input, tinted** — no custom box: `width/height:18px;
accent-color:var(--accent)`. The row is a `<label>` in `display:flex;
align-items:center; gap:var(--sp-3)`, its text taking the host block's own type scale.
Focus is the browser's own ring on the native control (inputs are deliberately excluded
from the global `:focus-visible` ring — `theming.md`).

Applies everywhere: "Rester connecté" (login), the Repas proposal meal picker, the
leftover-modal row checkboxes, and the Aliments/Recettes "Afficher les archivé·es"
filter — desktop popover **and** mobile filter sheet.

## Radio

Same recipe as the checkbox: native `<input type="radio">`, `width/height:18px;
accent-color:var(--accent)`, in a flex `<label>` row. (Invite-modal account type.)

## Segmented / toggle controls

See foundations `.seg`. Also `.toggle`, `.visseg`, `.rangeseg`, `.yearseg`,
`.typefilter` — all the same pattern: `inline-flex; border:1px solid var(--border);
border-radius:var(--r-md); overflow:hidden`; buttons borderless on `--bg-field`
(or `--bg-elev-2`), selected → `--accent`/`--accent-ink`. `--font-num; --fs-11–12`.

The recipe builder's **"Poids auto" toggle** (RW-1) is this same pattern (two
options, `aria-pressed`); when auto is ON the batch-weight number input takes the
standard **disabled/locked** state above (`opacity:.5; pointer-events:none`).

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
Placeholder notes accent-insensitivity ("insensible aux accents"). The component
**forwards its ref** to the inner `<input>` so a search overlay can hand it to the
modal focus trap as the initial-focus target (see `modals.md` — search overlays
auto-focus their input on open).

## Autocomplete dropdown (food/recipe search) `.ac`

`position:absolute; z-index:var(--z-autocomplete); background:var(--bg-elev-2);
border:1px solid var(--border-strong); border-radius:var(--r-md);
box-shadow:var(--shadow); max-height:240–300px; overflow:auto; min-width:260–280px`.

- **Vertical placement** (B-233): the list opens **below** the field by default and **flips above**
  it when there is no room below and more room above — measured against the nearest **clipping
  ancestor** (the Repas meal-table frame, a modal panel, else the viewport), so it is never cut off
  at a box's bottom edge. It **stays inside** that box (no portal / free-floating variant) and
  **keeps its `max-height`** — it never shrinks to fit a short window, so the flip is the only
  adaptation. Same hook as the badge dropdowns' flip (`rating-stars.md`).
- **item** `.item`: grid `1fr auto`; name (`--fs-12.5`) + meta (`--font-num;
--fs-10; --text-faint`, e.g. `121 kcal /100g`). Match highlight `em` →
  `color:var(--accent); font-style:normal`.
- **states**: hover/highlighted `.hi` → `background: color-mix(... accent 14% ...)`;
  current `.cur` → 1px accent outline; **disabled** `.disabled` (would create a
  recipe cycle) → `opacity:.4; cursor:not-allowed`; **empty** `.empty` →
  "Aucun résultat" in `--text-faint`.
- **tags**: a `portion` tag and a `recette` (`--recipe`) badge can appear inline.
- A **custom option** `.custom-opt` (`color:var(--accent)`) → "+ Valeurs
  manuelles (custom)…" opens the custom-food modal. It is **leading** (first row) when the query is
  **empty** and **trailing** (last row) once the user types (B-159) — so Enter/Tab keep selecting the
  first food while searching (B-023). It is never keyboard-highlighted (mouse/tap only).
- Keyboard: ↑/↓ move `.hi`, Enter selects, Esc closes; Tab navigates the grid.
- **Auto-focus**: the input **self-focuses on mount** (with `{ preventScroll: true }`, per
  `modals.md`), so the keyboard opens immediately where one exists.
- **≤560px: this dropdown is not used.** The three search hosts — the Repas food picker, the
  recipe-builder ingredient picker and the Paramètres garde-manger picker — render the shared
  **picker sheet** instead (`modals.md` §Overlay taxonomy / §Keyboard-aware search sheets): a
  pinned search field with large tappable rows, which a dropdown anchored to a dense cell cannot
  be. The `.ac` spec above therefore describes the **desktop and tablet** presentation only
  (≥561px, where it is byte-identical). Everything the dropdown does that the user can perceive —
  the current-item marker, the `recette` / `portion` tags, disabled entries, the empty label and
  the leading/trailing custom option (B-159) — has a counterpart in the sheet, so the two
  presentations stay behaviourally in parity.
  - The autocomplete input itself still honours `--fs-13` (= 16px) at ≤560px to avoid iOS
    focus-zoom (spec §8), because a phone in **landscape** exceeds 560px and keeps the dropdown
    (B-230).

Day comment, food name (recipe header), Journal comment: transparent field that
shows a `--border` on hover and `--focus` + `--bg-field` on focus — reads as
text until engaged.

## States (forms overall)

default · hover · focus · invalid · disabled/locked · with-suffix · loading
(skeleton field). Touch targets honour `--tap` (40→44 mobile).
