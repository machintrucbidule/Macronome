# Rating stars (0–3) + unrated

Food rating. Three stars, four real grades (0 Bof, 1 Moyen, 2 Ok, 3 Top) **plus
a distinct unrated state**. Per masterplan + `DECISIONS.md` Gap #7.

## Primitives
- **Star glyph** `★`. Filled = `color:var(--star)`; empty = `color:var(--star-off)`.
- **Read-only stars** (`.stars`): `display:inline-flex; gap:2px`; each `.s`
  `--fs-13; line-height:1`. `.s.on` → `--star`. Used in the Aliments table cell.
- **Picker** (`.ratepick`, in the food modal): same glyphs at `--fs-22;
  cursor:pointer`; click star *i* sets rating = *i*. A trailing **`effacer`**
  text button (`--font-num; --fs-10; color:var(--text-faint)`) clears to unrated.

## States  — [Gap #7 mapping, CONFIRMED in DECISIONS.md]
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
