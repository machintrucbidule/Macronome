# Logic spec — Ciqual reference catalog

Covers **B-289** (`DECISIONS.md` → "CIQ-1"). Defines how the published Ciqual food-composition
table is turned into the rows of `food_ref` (`spec/schema/tables-catalog.md`): which source files
and constituents are read, how a published value is parsed, and when an entry is kept, derived or
dropped. See `00-conventions.md` (SI units, kcal, display rounding).

The catalog is **reference data, not user data**: it carries no owner, is never exported, never
wiped, and is never shown to the AI. A row becomes a real `food` only when the user adopts it,
which copies the values across (`spec/api/foods-recipes.md`).

The extraction runs **offline**, in a generator script, and its output is committed with the
source; the application only ever reads that extract. Re-running the generator against a newer
edition is the whole upgrade path (§6).

## 1. Source & edition

Edition **Ciqual 2025** (published 2025-11-03), by **Anses**, distributed under **Licence Ouverte
Etalab 2.0** — attribution to Anses is mandatory wherever the data is reused, hence the notice in
both READMEs and on the app's À propos screen. DOI `10.57745/RDMHWY`.

Four XML files, all `TABLE`-rooted, UTF-8 with a BOM, CRLF line endings, every text value padded
with one leading and one trailing space (trim before use):

| file       | record       | what is read                                                                                                                                     |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alim`     | `<ALIM>`     | `alim_code`, `alim_nom_fr`, `alim_nom_eng`, `alim_grp_code`                                                                                      |
| `alim_grp` | `<ALIM_GRP>` | `alim_grp_code` → `alim_grp_nom_fr` / `alim_grp_nom_eng` (level-1 label; rows are denormalised level1→2→3 paths, so the first row per code wins) |
| `const`    | `<CONST>`    | nothing at runtime — read only to assert the four constituent codes of §2 still carry their expected labels                                      |
| `compo`    | `<COMPO>`    | `alim_code`, `const_code`, `teneur`                                                                                                              |

The raw XML is **not** committed (it is ~69 MB for `compo` alone); it lives in the git-ignored
corpus. An absent optional value is a self-closing element with a `missing` attribute
(`<alim_nom_sci missing=" " />`); `<teneur>` is never self-closing — an unmeasured value is the
literal `-`. Codes (`alim_code`, `alim_grp_code`) are **zero-padded strings** and must not be
parsed as integers.

## 2. Constituents read

Exactly four, selected **by `const_code`**, never by `code_INFOODS` (which is ambiguous — codes
327/328/333 all carry `ENERC`):

| `const_code` | meaning                                             | target column      |
| ------------ | --------------------------------------------------- | ------------------ |
| `328`        | Energy, Regulation EU No 1169/2011 (**kcal**/100 g) | `kcal_per_100g`    |
| `40000`      | Fat (g/100 g)                                       | `fat_per_100g`     |
| `31000`      | Carbohydrate (g/100 g)                              | `carb_per_100g`    |
| `25000`      | Protein, N × Jones factor (g/100 g)                 | `protein_per_100g` |

`327` (the kJ twin) and `333` ("energy with fibres") are deliberately **not** used: `328` is the
figure printed on EU nutrition labels, which is what every other kcal figure in Macronome means.
There is no usable energy fallback in the dataset — `333` has no coverage on the rows where `328`
is absent, which is what forces the derive rule of §4.

## 3. Parsing a `teneur` value

A published value is one of four forms. Decimals use a **comma**; scientific notation (`1E-6`) may
appear and is read as a plain number.

| form            | meaning                                                            | parsed as               |
| --------------- | ------------------------------------------------------------------ | ----------------------- |
| `12,5` / `1140` | measured                                                           | the number (12.5, 1140) |
| `traces`        | present below quantifiable                                         | **0**                   |
| `< 0,01`        | below the limit of quantification (any threshold, including `< 0`) | **0**                   |
| `-`             | not measured                                                       | **unknown**             |

`<` is XML-escaped as `&lt;` in the raw bytes. "Unknown" is a distinct third state from 0 — §4
treats it differently depending on which constituent it applies to.

## 4. Keep, derive or drop

Let `E` be the parsed energy (const 328) and `L`/`G`/`P` the parsed fat/carb/protein.

1. **`E` known** → the entry is kept with `kcal_per_100g = E` and `energy_derived = false`. Any
   macro that is **unknown** is stored as **0** (an unmeasured macro on a food whose energy is
   published is not a reason to lose the food).
2. **`E` unknown**, `L`, `G` **and** `P` all known, and the food's level-1 group is **not `06`**
   → the entry is kept with `kcal_per_100g = 9·L + 4·G + 4·P` (the energy densities of
   `00-conventions.md`), rounded to **1 decimal**, and `energy_derived = true`.
3. **`E` unknown** and the food's level-1 group **is `06`** (beverages) → the entry is
   **dropped**. Alcohol is not among the four constituents read, so an alcoholic drink would
   derive to a false ~0 kcal — a wrong figure is worse than a missing entry.
4. **`E` unknown** and at least one of `L`/`G`/`P` unknown → the entry is **dropped**.

Macro values are stored **as published**, at full precision; only a derived energy is rounded
(§4.2). All four columns are `NOT NULL, CHECK ≥ 0` — the rules above guarantee a value for each.

The keep/derive/drop decision never depends on a food's group **label**, only on its group
**code** (§4.3) — an unlabelled group is a metadata gap, not a reason to lose published values
(§5).

## 5. Names & groups on the row

`name_fr` = `alim_nom_fr`, `name_eng` = `alim_nom_eng` (falling back to `alim_nom_fr` if absent).
`group_label_fr` / `group_label_eng` = the **level-1** group labels only (11 of them); the level-2
and level-3 sub-groups are not stored.

**Unlabelled group.** The 2025 edition carries one food (an "average food" aggregate) whose
`alim_grp_code` is the sentinel `00`, which the group table does not declare. Its composition is
fully published, so the entry is **kept** and labelled **"non classé" / "unclassified"** rather
than dropped or filed under an unrelated official group. The label is ours, not Anses's, and is
the only invented one; it appears in the catalog's group filter like any other.

`normalized_name_fr` / `normalized_name_eng` are **not** in
the committed extract: they are computed at seed time with the same normalisation as
`food.normalized_name` (`spec/schema/indexes.md`), so a reference entry and a user's food compare
byte-for-byte — that equality is what the duplicate rule of the catalog view relies on.

## 6. Seeding & editions

The committed extract carries a **dataset id** (`ciqual_2025`). On boot the application compares
it with the id present in `food_ref`: equal → nothing happens; different (or the table is empty) →
the whole table is replaced in **one transaction**. Seeding is therefore idempotent and automatic
on upgrade, with no operator action and nothing to undo. A future edition is a re-run of the
generator plus a new dataset id.

Adopting a reference entry never links back to it: the created `food` is an independent copy
(`source = 'ciqual'`), so a later edition can freely change or remove the reference row without
touching anything the user has saved.

## 7. Worked examples (oracles)

Synthetic records, one per rule. Format: `inputs:` the raw `teneur` strings for
`{E(328), L(40000), G(31000), P(25000)}` plus the level-1 group code → `expected:` either
`DROP` or `{kcal, fat, carb, protein} derived=<bool>`.

```
O-1  (all four published — the ordinary case)
inputs:  group 03 · E ' 250 ' · L ' 12,5 ' · G ' 30 ' · P ' 8,2 '
expected: {250, 12.5, 30, 8.2} derived=false

O-2  (traces and below-LOQ macros → 0)
inputs:  group 02 · E ' 45 ' · L ' traces ' · G ' < 0,5 ' · P ' 1,2 '
expected: {45, 0, 0, 1.2} derived=false

O-3  (unmeasured macro while energy is published → 0, entry kept)
inputs:  group 05 · E ' 120 ' · L ' 3 ' · G ' - ' · P ' 4 '
expected: {120, 3, 0, 4} derived=false

O-4  (energy unmeasured, all macros known, non-beverage → derived)
inputs:  group 03 · E ' - ' · L ' 2 ' · G ' 20 ' · P ' 5 '
expected: {118, 2, 20, 5} derived=true          (9×2 + 4×20 + 4×5 = 118)

O-5  (energy unmeasured, beverage group 06 → dropped, never derived)
inputs:  group 06 · E ' - ' · L ' 0 ' · G ' 5 ' · P ' 0 '
expected: DROP

O-6  (energy unmeasured and a macro unmeasured → dropped)
inputs:  group 02 · E ' - ' · L ' 1 ' · G ' - ' · P ' 2 '
expected: DROP

O-7  (derived energy is rounded to 1 decimal)
inputs:  group 09 · E ' - ' · L ' 1,11 ' · G ' 2,22 ' · P ' 3,33 '
expected: {32.2, 1.11, 2.22, 3.33} derived=true (9.99 + 8.88 + 13.32 = 32.19 → 32.2)

O-8  (a published energy on a beverage is kept — only the derive is excluded)
inputs:  group 06 · E ' 42 ' · L ' 0 ' · G ' 10,5 ' · P ' - '
expected: {42, 0, 10.5, 0} derived=false

O-9  (threshold of zero, and scientific notation)
inputs:  group 10 · E ' 0 ' · L ' < 0 ' · G ' 1E-6 ' · P ' 0 '
expected: {0, 0, 0.000001, 0} derived=false
```
