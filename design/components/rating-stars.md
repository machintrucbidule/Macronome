# Rating stars (0–3) + unrated

Food rating. Three stars, four real grades (0 Bof, 1 Moyen, 2 Ok, 3 Top) **plus
a distinct unrated state**. Per masterplan + `DECISIONS.md` Gap #7.

## Primitives

- **Star glyph** `★`. Filled = `color:var(--star)`; empty = `color:var(--star-off)`.
- **Read-only stars** (`.stars`): `display:inline-flex; gap:2px`; each `.s`
  `--fs-13; line-height:1`. `.s.on` → `--star`. Used in the Aliments table cell.
- **Picker** (food modal + recipe builder): a **dropdown** (the `SelectMenu`
  pattern — clickable trigger + listbox, like the activity-level select) listing
  the **five states explicitly**, top → bottom: **Pas noté**, **0/Bof** (three
  empty stars), **1/2/3** (filled). The four graded options show **the star
  visual only** (no text label); the **Pas noté** option is shown as the text
  "Pas noté" (`--text-faint`, no stars). The grade label rides as an `aria-label`
  for screen readers. The trigger shows the current state; selecting an option
  sets the rating. Every state — including unrated and 0/Bof — is reachable in one
  click and visually distinct. The menu flips/clamps to stay inside the modal panel
  (never clipped by `.modal { overflow:auto }`). (B-121; replaces the former
  click-stars-plus-`effacer` picker.)

## States — [Gap #7 mapping, CONFIRMED in DECISIONS.md]

- **3 / Top** — 3 filled.
- **2 / Ok** — 2 filled, 1 empty.
- **1 / Moyen** — 1 filled, 2 empty.
- **0 / Bof** — the **3-star widget with 0 filled** (three `--star-off` stars).
  This is a real grade.
- **unrated (null, default)** — **em-dash `—`, no star widget at all**
  (`color:var(--text-faint)`). Must be unmistakably different from 0/Bof: a bare
  dash vs an empty-star control.
- **hover (picker)**: optional preview fill up to the hovered star (not in the
  mockup; safe to add, keep `--star` at reduced opacity if implemented).

## Filter semantics (Aliments)

The "note minimale" chips (`Toutes / ≥1 / ≥2 / 3`) treat unrated as below 1:
`≥1` excludes **both** Bof (0) **and** unrated. (Behaviour owned by 2b; the
control is a chip group — see `forms-inputs.md`.)
