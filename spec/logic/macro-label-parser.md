# Logic spec — macro label parser

Covers **PM-1 / B-114** (`DECISIONS.md`). Parses free-text nutrition information pasted
from a grocery site into the four per-100 g figures the Aliments add/edit modal holds:
`{kcal, fat, carb, protein}`. Pure text→numbers logic (no DB); served by the stateless
`POST /foods/parse-label` (`spec/api/foods-recipes.md §Foods`). See `00-conventions.md`
(SI units, kcal). The web renders the result; it never parses (CLAUDE.md rule 2).

The contract is driven by real FR/EN labels (EU Reg. 1169/2011 mandates the order
energy · fat · saturates · carbohydrate · sugars · protein · salt, declared **per 100 g
or 100 ml**; French tables print **"Matières grasses" _or_ "Lipides"**; English/Open Food
Facts use energy-kj/energy-kcal/fat/carbohydrates/proteins).

## 1. Inputs & output

- **Input:** one free-text blob (the raw clipboard paste), ≤ 10 000 chars.
- **Output (success):** the macros that were **found**, each per 100 g, any of the four
  possibly **absent** (fill-found-leave-missing, §6) + a list of `warnings`.
- **Output (failure):** a structured error `code` (§5); **no** values.

Matching is **case-insensitive and accent-insensitive**, singular **or** plural, FR
**or** EN. Numbers use comma **or** dot decimals (`9,4` / `9.4`) and may carry thousands
spaces, incl. the non-breaking space (`1 510` → 1510). Values are read in **grams**
(`mg`/`µg`/`%` only ever appear on ignored rows/columns).

## 2. Energy → kcal

Scan the whole text for the first **kcal** figure: in parentheses
(`549,0 kj (130,0 kcal)`), after a slash (`251 kj/59 kcal`), or as a bare `… 56 kcal`
token. A non-integer kcal is **preserved** (e.g. `341,78` → 341.78). The leading per-100
column is printed first on EU labels, so "first kcal in the text" is the per-100 value.

If **no kcal** appears anywhere, fall back to the first **kJ** figure ÷ **4.184**
(`KCAL_PER_KJ`, `shared/constants/energy.ts`), **rounded to the nearest integer**, and add
the warning `kcal_from_kj`. If neither kcal nor kJ is present, energy is simply absent
(not an error on its own).

## 3. Macro label recognition (synonyms) & the "dont/of which" rule

Each line is classified by its **leading label** (after trim + normalise). A line is
**skipped** if its leading label is a _subset breakdown_ or a non-macro nutrient; the main
macro value is the first number on the **main-label** line — even if the merged paste
trails a `dont …` on the same line (so `Matières grasses dont 0,20 g` → fat 0.20).

**Skip (checked first)** — leading label begins with any of: `dont`, `of which`, `acides
gras satur…` / `ag satur…` / `satur…` (saturates/saturated), `sucres` / `sugars`,
`polyols`, `amidon` / `starch`, `fibre(s)` / `fiber`, `sel` / `salt` / `sodium`,
`sels minéraux` / `minéraux`, `magnésium`, `fer`, `calcium`, `potassium`,
`vitamine`/`vitamin`, `mono…` / `poly…` / `oméga…` (unsaturated breakouts),
`cholestérol`. Any trailing `%` / RI column (`% AQR`, `% RNJ`, `% VNR`, `% AR`,
`apports de référence`, `reference intake`, `RI`) is never read because only the **first**
number on a main line is taken.

**Energy** — `énergie`, `energie`, `valeur(s) énergétique(s)`, `apport énergétique`,
`energy`, `energy value`, `calories`.
**Fat** — `matières grasses`, `matière grasse`, `lipides`, `lipide`, `graisses`, `fat`,
`total fat`, `fats`.
**Carb** — `glucides`, `glucide`, `carbohydrate(s)`, `carbs`, `total carbohydrate`.
**Protein** — `protéines`, `protéine`, `matières protéiques`, `protein(s)`.

A line that matches no label is ignored. If a matched main line carries no number, the
first number on the following line(s) is used (pure vertical layout where label and value
are on separate lines).

## 4. Reference weight & scaling

Resolve a single scale factor applied to **every** read value (kcal included):

1. A **reconstituted** marker anywhere → **ERROR** `reconstituted_label` (§5): `après
préparation`, `état après préparation`, `reconstitué`, `as prepared`, `once prepared`,
   `as consumed`. The as-sold (dry) value is unknowable.
2. Else collect mass references `(pour|per|par|aux|/) <N> (g|ml|…)`. If any **N = 100** →
   scale **1** (per-100, incl. `pour 100 g/100 ml`). A **two-column** "pour 100 g" + "par
   portion / par X g" therefore resolves to the per-100 g column (its values are printed
   first, so the first-number rule reads them).
3. Else a single explicit mass reference **N ≠ 100** → scale **100 ⁄ N**, warning
   `scaled_from_ref` (e.g. "pour 30 g" → ×100⁄30).
4. Else a **serving/portion** reference with no usable gram weight (`portion`, `part`,
   `serving`, `pièce`, `biscuit`, `tranche`, `verre`, `unité`) and no per-100 column →
   **ERROR** `no_reference` (cannot normalise to 100 g).
5. Else (no reference at all) → scale **1** — assume per-100 g, the EU legal default;
   this covers the common header-less vertical paste.

Scaled values are rounded to **2 decimals**; an unscaled value is kept verbatim.

## 5. Errors (write nothing)

- `reconstituted_label` — a reconstituted/"après préparation" label (§4.1).
- `no_reference` — an un-normalisable serving reference (§4.4).
- `unparseable` — **nothing** usable found (no kcal/kJ **and** no fat/carb/protein).

The endpoint maps each to **422** `{error:{code}}` (`spec/api/foods-recipes.md`).

## 6. Fill found, leave missing

Only the macros actually found are returned; a missing macro line leaves its field
**untouched** in the modal (no zero written, no error). When **fewer than four** of
{kcal, fat, carb, protein} are found (but at least one is), add the warning
`macro_missing`. Found values **overwrite** whatever was in the field.

## 7. Warnings

Non-blocking, returned alongside the values: `kcal_from_kj` (§2), `scaled_from_ref` (§4.3),
`macro_missing` (§6). The web surfaces them as a discreet note after applying.

## 8. Worked examples (oracles)

Format: `inputs:` (the pasted text, `·` = newline) → `expected:` a 4-tuple
`{kcal, fat, carb, protein}` per 100 g (absent = field left untouched) + warnings, or
`ERROR <code>`. EX-01…EX-13 are the author's real pastes; D-1…D-7 are derived from the
decisions.

```
EX-01  (vertical, no header)
inputs:  Energie 225,0 kj (53,0 kcal) · Matière Grasse 0,1 · Glucides 3,6 ·
         Protéines 9,4 · Dont sucres 1 · Sel 0,09 · Fibres 0
expected: {53, 0.1, 3.6, 9.4}

EX-02  (table, "pour 100 g")
inputs:  pour 100 g · Energie 251 kj/59 kcal · Matières grasses dont 0,20 g ·
         Glucides dont 4,80 g · Protéines 9,80 g
expected: {59, 0.20, 4.80, 9.80}

EX-03  (table, "pour 100g (jaune + blanc)")
inputs:  pour 100g · 584 kj/140 kcal · Matières grasses 9,80 · Glucides 0,50 · Protéines 13
expected: {140, 9.80, 0.50, 13}

EX-04  (table, "pour 100 g" + % columns)
inputs:  pour 100 g · Energie 240 kj/56 kcal 4 %/4 % · Matières grasses 0 g 1 % ·
         Glucides 3,80 g 2 % · Protéines 9,60 g 29 %
expected: {56, 0, 3.80, 9.60}

EX-05  (table, "pour 100 g/100 ml"; thousands space)
inputs:  pour 100 g/100 ml · 1 510 kj/362 kcal 18 %/18 % · Matières grasses 15 g ·
         Glucides 32 g · Protéines 34 g · Fibres 5,90 · Magnésium … · Fer …
expected: {362, 15, 32, 34}

EX-06  (table, "pour 100 millilitre état après préparation")   ← canonical error
inputs:  pour 100 millilitre etat apres preparation · 154 kj/37 kcal · …
expected: ERROR reconstituted_label

EX-07  (table, "pour 100 g"; thousands space)
inputs:  pour 100 g · 1 700 kj/410 kcal · Matières grasses 34 g · Glucides 0 g · Protéines 26 g
expected: {410, 34, 0, 26}

EX-08  (table, "pour 100ml")
inputs:  pour 100ml · Energie 306 kj/72 kcal 4 %/4 % · Matières grasses 0,50 g ·
         Glucides 18 g 4 % · Protéines 0 g
expected: {72, 0.50, 18, 0}

EX-09  (vertical, "pour 100g")
inputs:  pour 100g · 549,0 kj (130,0 kcal) · Matières grasses 1,8 · Glucides 19 · Protéines 6,9
expected: {130, 1.8, 19, 6.9}

EX-10  (vertical, "pour 100mL")
inputs:  pour 100mL · 169,0 kj (40,0 kcal) · Matières grasses 1,6 · Glucides 5,1 ·
         Protéines 0,9 · Fibres 1
expected: {40, 1.6, 5.1, 0.9}

EX-11  (vertical, no header; non-integer kcal preserved)
inputs:  1430,0 kj (341,78 kcal) · Matières grasses 14 · Glucides 27 · Protéines 32
expected: {341.78, 14, 27, 32}

EX-12  (vertical, "pour 100g")
inputs:  pour 100g · 584,0 kj (140,0 kcal) · Matières grasses 7,4 · Glucides 9,8 ·
         Protéines 7,9 · Fibres 1,2
expected: {140, 7.4, 9.8, 7.9}

EX-13  (vertical, no header)
inputs:  225,0 kj (53,0 kcal) · Matières grasses 0,1 · Glucides 3,6 · Protéines 9,4 · Fibres 0
expected: {53, 0.1, 3.6, 9.4}

D-1  (explicit reference weight → scale ×100/30)
inputs:  pour 30 g · Energie (160 kcal) · Matières grasses 6 · Glucides 18 · Protéines 3
expected: {533.33, 20, 60, 10}  warnings:[scaled_from_ref]

D-2  (partial label — protein line absent → leave it, no error)
inputs:  pour 100 g · 200 kcal · Matières grasses 10 · Glucides 20
expected: {200, 10, 20}  warnings:[macro_missing]

D-3  (kJ only — no kcal → kJ ÷ 4.184, rounded)
inputs:  pour 100 g · Energie 2110 kj · Matières grasses 14 · Glucides 27 · Protéines 32
expected: {504, 14, 27, 32}  warnings:[kcal_from_kj]

D-4  (FR synonym "Lipides" instead of "Matières grasses")
inputs:  pour 100 g · 250 kcal · Lipides 12 · Glucides 30 · Protéines 8
expected: {250, 12, 30, 8}

D-5  (English EU label)
inputs:  per 100g · Energy 2252kJ/539kcal · Fat 30.9 · of which saturates 10.6 ·
         Carbohydrate 57.5 · of which sugars 56.3 · Protein 6.3 · Salt 0.107
expected: {539, 30.9, 57.5, 6.3}

D-6  ("dont/of which" sub-line trap — saturates/sugars must not be read as fat/carb)
inputs:  pour 100 g · 500 kcal · Matières grasses 30 · dont acides gras saturés 12 ·
         Glucides 50 · dont sucres 40 · Protéines 8
expected: {500, 30, 50, 8}

D-7  (two-column "pour 100 g / par portion 30 g" → take the per-100 g column)
inputs:  pour 100 g   par portion (30 g) · Energie 400 kcal 120 kcal ·
         Matières grasses 20 g 6 g · Glucides 50 g 15 g · Protéines 10 g 3 g
expected: {400, 20, 50, 10}
```
