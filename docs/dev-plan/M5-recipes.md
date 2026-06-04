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

- [x] recipe + recipe_ingredient tables + migration (`20260604100000_recipes`; CHECKs incl.
      ref XOR + `ref_recipe_id <> recipe_id`, GIN trigram, owner/recipe FKs)
- [x] domain/recipes + neutral oracle tests (per100/perPortion, batch invariance, transitive cycle)
- [x] recipes service (builds derived food, forward-only recompute + parent cascade) + repo + route
- [x] Recettes screen: builder (ingredient block, yield panel, instructions), nav tab, FR+EN i18n
- [x] integration: 422 would_create_cycle (incl. transitive), derived-food rebuild + "portion",
      forward cascade with frozen meal_entry, tenancy 404, `/search/loggable`
- [x] acceptance: recipes neutral oracles + listed integration cases + e2e (build → save → log
      1 portion) green

### Carried over from M1 (built here)

- [x] **`GET /search/loggable`** — food ∪ recipe-derived food, excludes archived, returns
      `{id,name,kind,recipe_id,named_portions}` (`recipe_id` added so the picker can reference a
      nested recipe). Web client `api/loggableSearch.ts`. The Repas daily-log search now uses it.
- [x] **`food.recipe_id` FK** — `food.recipe_id → recipe(id)` added in the M5 migration; set when
      `source='recipe'`. `GET /foods` now excludes `source='recipe'` (browse foods only).

### Deviations / deferrals (tracked)

- **Builder live recompute → M9.** Per-line / per-portion / per-100 g figures are computed
  server-side and shown from the loaded recipe + on save (CLAUDE.md rule 2). Live-while-typing
  recompute is deferred to M9 (same precedent as the M2 Cibles tiles).
- **Cycle-disable in the picker is self-only (client); transitive enforced server-side** (422 →
  banner). Full client-side transitive disabling → M9.
- **Daily-log dropdown lost the `kcal/100g` meta** when it switched to `/search/loggable`
  (loggable omits macros by contract). Restore in M9 polish.
- **Recipe sort** limited to name/batch/servings (recipe-native). Derived macro columns are
  display-only (live on the derived food), like foods' "Portion NOT sortable".
- **No `/recipes/:id` / `/recipes/new` routes** — the builder uses modal state like the Foods
  screen; deep-link routes → M9 if wanted. Modal gained a shared `wide` size.
