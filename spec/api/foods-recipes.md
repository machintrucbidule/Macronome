# API — foods, recipes, containers

See `00-conventions.md`. All scoped to the authenticated user.

## Foods

- `GET /foods` — browse foods only (no recipes). Query: `q` (autocomplete),
  `min_rating` (1|2|3 — excludes Bof 0 and unrated when ≥1), `visibility`
  (private|shared), `include_archived` (bool, default false),
  `sort` ∈ {name,kcal,fat,carb,protein,rating,visibility,usage} (Portion NOT sortable,
  OPEN_GAPS #10), `dir`, `limit`, `cursor`. **`usage`** (FU-1) orders by the food's
  **meal-log count over the last 90 days** (most-used first for `dir=desc`), ties broken by
  most-recent use then name; usage is derived from `meal_entry` at query time (no stored
  column). Only **consumed** entries count — those with `served_quantity > 0`; quantity-0
  lines (unfilled pinned placeholders, B-045) are not usage and do not count (B-157). **Every**
  `GET /foods` list response carries a `usage` integer on each Food (the 90-day consumed
  count), regardless of `sort` (B-156).
  → 200 `{data:[Food], next_cursor}`.
- `GET /foods/:id` → 200 Food | 404.
- `POST /foods` — create. Body: `{name, kcal_per_100g, fat_per_100g,
carb_per_100g, protein_per_100g, comment?, rating?(null|0..3),
visibility?(default 'private'), named_portions:[{label,grams}]}`.
  Validation: macros ≥ 0; grams > 0; labels unique per food. Duplicate active
  name → 200/201 with `warnings:['duplicate_name']` (non-blocking). → 201 Food.
- `PATCH /foods/:id` — edit. Editing macros affects **future** logs only (past
  meal_entry snapshots untouched). → 200 Food.
- `POST /foods/:id/archive` → 200 (sets archived_at; removed from search/list).
- `POST /foods/:id/restore` → 200.
- `POST /foods/parse-label` — **stateless** macro-label parser (PM-1/B-114). Body
  `{label_text}` (1..10000 chars) = nutrition text pasted from a grocery site. Deduces
  the per-100 g figures per `logic/macro-label-parser.md`; persists nothing. Found macros
  only (any of the four may be absent → the client leaves that field untouched). →
  200 `{data: ParseLabel, warnings?:['kcal_from_kj'|'scaled_from_ref'|'macro_missing']}`.
  Structurally-impossible input → **422** `{error:{code}}` with `code` ∈
  `{reconstituted_label, no_reference, unparseable}` (writes nothing).

**ParseLabel** payload (per 100 g; each field optional — only the macros found):

```json
{ "kcal_per_100g": 362, "fat_per_100g": 15, "carb_per_100g": 32, "protein_per_100g": 34 }
```

**Food** payload:

```json
{ "id","owner_id","name","kcal_per_100g","fat_per_100g","carb_per_100g",
  "protein_per_100g","comment","rating": null,
  "visibility":"private","source":"manual","recipe_id":null,
  "named_portions":[{"id","label","grams"}],"archived_at":null }
```

## Recipes

- `GET /recipes` — recipes only. Query: `q`, `min_rating` (1|2|3 — excludes Bof 0
  and unrated when ≥1, mirrors foods), `include_archived`, `sort` ∈
  {name,batch,servings,rating} (derived macro columns NOT sortable, cf. OPEN_GAPS #10),
  `dir`, `limit`, `cursor`.
  → 200 `{data:[RecipeSummary], next_cursor}` (incl. derived per-100 g, batch,
  `batch_weight_auto`, servings, weight/portion, rating).
- `GET /recipes/:id` → 200 RecipeFull (ingredients + instructions + derived +
  rating + `batch_weight_auto`).
- `POST /recipes` — `{name, instructions?, rating?(null|0..3), total_batch_grams?,
batch_weight_auto?, servings(≥1),
ingredients:[{ref_type,ref_id,quantity,unit,portion_id?,order_index}]}`.
  Validation: servings ≥ 1; total_batch_grams > 0 (default Σ ingredient grams);
  **transitive cycle check** — reject an ingredient that makes the graph cyclic
  → 422 `{details:{ingredient:'would_create_cycle'}}`. No custom-inline
  ingredients. On save (re)builds the derived food + auto "portion" named
  portion (= batch/servings). → 201.
  **`batch_weight_auto`** (RW-1): `true` ⇒ the batch weight is server-maintained
  = Σ ingredient grams (`total_batch_grams` must be **absent** — both present
  → 422 `{details:{total_batch_grams:'conflicts_with_auto'}}`); default on create
  = `true` when `total_batch_grams` is absent, `false` when present.
- `PATCH /recipes/:id` — same (incl. `rating`); edits recompute the derived food
  **going forward**; nested-recipe edits cascade to parents going forward. → 200.
  Partial semantics for the flag: absent ⇒ the stored state is kept (an **auto**
  recipe re-resolves batch = Σ of the final ingredients; sending
  `total_batch_grams` alone flips the recipe to manual); `true` ⇒ batch
  re-resolves to Σ (same both-present 422 as POST).
- `POST /recipes/:id/archive` · `POST /recipes/:id/restore`.
- `POST /recipes/preview` — **stateless** live recompute for the builder (an
  unsaved draft). Body = the recipe body **without `name`**: `{servings(≥1),
total_batch_grams?, ingredients:[{ref_type,ref_id,quantity,unit,portion_id?,
order_index}]}`. Resolves each ingredient (user-scoped) and returns the derived
  figures **without persisting anything** (no row written, no derived-food rebuild,
  **no cycle check** — read-only). Empty `ingredients` → all figures `0`.
  → 200 `{data: RecipePreview}`. No `batch_weight_auto` here: an auto draft simply
  omits `total_batch_grams` and the response's batch is Σ (RW-1).

**RecipePreview** payload (derived only; never posted):

```json
{ "total_ingredient_grams","total_batch_grams","servings",
  "kcal_per_100g","fat_per_100g","carb_per_100g","protein_per_100g",
  "weight_per_portion_g",
  "total_macros":{"kcal","fat","carb","protein"},
  "per_portion":{"kcal","fat","carb","protein"},
  "ingredients":[{"ref_type","ref_id","ref_name","quantity","unit","portion_id",
    "order_index","grams","kcal","fat","carb","protein","ref_named_portions":[...]}] }
```

Derived per-100 g / per-portion are computed server-side
(`logic/recipes-derived-food.md`); the client never posts them. The builder's live
yield panel reads them from `POST /recipes/preview` while editing, and the persisted
figures from `GET /recipes/:id` after save (cf. `screens/recipe.md` live recompute).

## Combined log search (food ∪ recipe-derived food)

- `GET /search/loggable?q=` — diacritic-insensitive autocomplete over foods AND
  recipe-derived foods (what the Daily log / cook mode / recipe ingredient picker
  use). Excludes archived. **Ordered most-used-first** (FU-1): by the item's 90-day
  meal-log count of **consumed** entries (`served_quantity > 0`; quantity-0 placeholder
  lines do not count, B-157), ties broken by most-recent use then name (recipes rank by
  their own logged usage, via their derived food). → 200 `{data:[{id,name,kind:'food'|'recipe',
named_portions:[...]}]}`.

## Containers

- `GET /containers` — query `q`, `sort` ∈ {name,weight}, `dir`. The built-in
  "Rien" (0 g) is always present, listed first, locked. → 200 `{data:[Container]}`.
- `POST /containers` — `{name, empty_weight_g(≥0)}`. → 201.
- `PATCH /containers/:id` — 200 (404/409 if built-in "Rien").
- `DELETE /containers/:id` — 204. **Unrestricted** (history froze its own
  value; OPEN_GAPS #13). Deleting "Rien" → 409 `container_locked`.
