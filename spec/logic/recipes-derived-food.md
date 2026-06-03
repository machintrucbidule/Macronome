# Logic spec — recipes & derived food

Covers §3.2, RECONCILIATION_LOG §C2 (transitive cycle), §G1 (servings ≥ 1).
See `00-conventions.md`.

## 1. Ingredients
- A `RecipeIngredient` references a **food OR another recipe** (`ref_type`,
  `ref_id`) with a quantity resolved to grams (g/ml/kg or a named portion of the
  referenced item → grams). **No custom-inline ingredients.**
- Each ingredient contributes macros = (referenced item's per-100 g macros) ×
  grams / 100. A nested recipe contributes via its own derived per-100 g macros.

## 2. Cycle check — fully transitive (RECONCILIATION_LOG §C2)
Adding ingredient `R` to recipe `E` is **forbidden** if `R == E` **or** `E` is
reachable from `R` through the ingredient graph (A→B→…→E). The builder disables
any such add. (The mockup's direct-only guard is under-implemented and not
authoritative.)

## 3. Batch weight & per-100 g macros
- `total_ingredient_grams = Σ ingredient grams`.
- `total_batch_grams` is **editable**, default = `total_ingredient_grams`,
  overridable to the measured cooked weight. Domain: > 0.
- `per100[m] = total_macro[m] / total_batch_grams × 100` for m ∈ {kcal,fat,carb,
  protein}.
- Correcting the batch weight changes per-100 g (concentration) and per-portion
  **weight**, but **not** the per-portion **macros** (total macros are unchanged
  by water loss).

## 4. Servings & per-portion (§G1: servings ≥ 1, integer)
- `weight_per_portion_g = total_batch_grams / servings`.
- `per_portion_macro[m] = total_macro[m] / servings`.

## 5. Derived food
Saving a recipe (re)builds a derived `Food` (source = recipe, owner = user) with
the computed per-100 g macros and an **auto named portion "portion"** of grams =
`total_batch_grams / servings`, so the Daily log can log "1 portion".
- Edits recompute the derived food **going forward only**; nested-recipe edits
  cascade to parents going forward. Past `MealEntry` snapshots stay frozen.

## 6. Worked example (oracle — "Sample bake", illustrative)
```
inputs (ingredient grams → macros, per the food rows):
  Ingredient A 200 g : kcal 400, L 10, G 50, P 20
  Ingredient B 300 g : kcal 150, L 2,  G 30, P 5
  Ingredient C 100 g : kcal 90,  L 1,  G 18, P 3
computation:
  total_ingredient_grams = 600
  total_kcal = 640 ; total L = 13 ; total G = 98 ; total P = 28
  if total_batch_grams left at 600:
  per100_kcal = 640 / 600 × 100 = 106.7 kcal/100 g
  servings = 4 → weight_per_portion = 600/4 = 150 g
            → per_portion_kcal = 640/4 = 160.0 kcal
  derived food gets named portion "portion" = 150 g.
note: if the cooked bake is weighed at 900 g, set total_batch_grams=900 →
  per100_kcal = 640/900×100 = 71.1 ; per-portion macros unchanged (160.0).
```
