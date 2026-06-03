# M5 — Recipes & derived food

**Goal:** recipes (food- or recipe-referencing ingredients), batch/per-portion maths,
the transitive cycle guard, and the derived `Food` a recipe produces so M3 can log
"1 portion". Depends-on: M1 (foods to reference; derived food joins the catalog).

## Scope

- `recipe`, `recipe_ingredient` (`spec/schema/tables-catalog.md`): ingredient
  references a food OR another recipe (`ref_type`, `ref_id`) resolved to grams; no
  custom-inline ingredients.
- Pure recipes (`spec/logic/recipes-derived-food.md`): `aggregateMacros`, `per100g`,
  `perPortion`, **`hasCycle` (fully transitive** A→B→…→E), `buildDerivedFood`.
  Editable `total_batch_grams` (default = Σ ingredient grams) changes per-100 g and
  per-portion **weight** but not per-portion **macros**. Servings ≥1 integer (Gap G1).
- Derived food: saving (re)builds an owned `Food` (source=recipe) with per-100 g
  macros + auto named portion "portion" = batch/servings. Edits recompute **forward
  only**; nested-recipe edits cascade to parents forward; past `meal_entry` snapshots
  stay frozen.
- Recettes screen (`specifications/screens/recipe.md`, `recipe.html`): ingredient
  builder (cycle-disabled adds), batch/servings inputs, derived-food preview,
  instructions.

## Files (via `module-map.md`)

API: `domain/recipes/` (+ `recipes.test.ts`), `services/recipes.ts`,
`data/repositories/recipe.repo.ts`, `http/routes/recipes.ts` + controller. DTOs
`shared/src/dto/recipe.ts`.
Web: `features/recipes/`, `api/recipes.ts`, components `DataTable/` (ingredient grid),
`Form/`, `Toast/` (would-create-cycle), `Modal/`.

## Acceptance criteria (neutral oracles)

- **recipes.test.ts:** per-100 g + per-portion on the neutral "Sample bake"
  (`A 200g/400kcal, B 300g/150, C 100g/90 → 600g/640kcal; per100 106.7; 4 servings →
150g/160.0 kcal`); batch-weight change keeps per-portion **macros** (cooked 900 g →
  per100 71.1, per-portion still 160.0); **transitive cycle rejected**.
- **Integration** (`testing.md` §2): **422 `would_create_cycle`**; save (re)builds the
  derived food + auto "portion"; tenancy → 404.
- **e2e (smoke):** build a recipe, save, then log its "1 portion" on a day (ties back
  to M3).

## Size check

Ingredient builder decomposes (grid + add-row + preview); cycle/aggregation maths live
only in `domain/recipes`.

## Checklist

- [ ] recipe + recipe_ingredient tables + migration
- [ ] domain/recipes + neutral oracle tests (per100/perPortion, batch invariance, cycle)
- [ ] recipes service (builds derived food, forward-only recompute) + repo + route
- [ ] Recettes screen: builder with cycle-disabled adds, batch/servings, preview
- [ ] integration: 422 would_create_cycle, derived-food rebuild, tenancy 404
- acceptance: recipes neutral oracles + listed integration cases green

### Carried over from M1 (build here, now that the recipe table exists)

- [ ] **`GET /search/loggable`** — diacritic-insensitive autocomplete over food ∪
      recipe-derived food (`spec/api/foods-recipes.md` §"Combined log search"); excludes
      archived; returns `{id,name,kind:'food'|'recipe',named_portions}`. Add the web client
      `packages/web/src/api/loggableSearch.ts`. Deferred from M1 (no recipe table then).
- [ ] **`food.recipe_id` FK** — add the foreign key to `recipe(id)` (the column already
      exists as a plain nullable Uuid from M1; add the FK in this milestone's migration SQL,
      set when `source='recipe'`).
